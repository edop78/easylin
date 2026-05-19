import os
import shlex
import subprocess
import threading
import datetime

try:
    from config import Config
except ImportError:
    from backend.config import Config

from .services import get_container_id, get_temp_status_path, run_host_command

MAINTENANCE_COMMANDS = {
    # Updates
    "update": "DEBIAN_FRONTEND=noninteractive apt-get update",
    "upgrade": "apt-mark hold docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -o Dpkg::Options::=\"--force-confdef\" -o Dpkg::Options::=\"--force-confold\"",
    "full-upgrade": "apt-mark hold docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && DEBIAN_FRONTEND=noninteractive apt-get full-upgrade -y -o Dpkg::Options::=\"--force-confdef\" -o Dpkg::Options::=\"--force-confold\"",
    "dist-upgrade": "apt-mark hold docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && DEBIAN_FRONTEND=noninteractive apt-get dist-upgrade -y -o Dpkg::Options::=\"--force-confdef\" -o Dpkg::Options::=\"--force-confold\"",
    "fix-broken": "apt-mark hold docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && DEBIAN_FRONTEND=noninteractive apt-get install -f -y -o Dpkg::Options::=\"--force-confdef\" -o Dpkg::Options::=\"--force-confold\"",
    "fix-dpkg": "dpkg --configure -a",
    "release-upgrade": "do-release-upgrade -f DistUpgradeViewNonInteractive",
    "release-upgrade-dev": "do-release-upgrade -d -f DistUpgradeViewNonInteractive",
    
    # Cleaning
    "autoremove": "DEBIAN_FRONTEND=noninteractive apt-get autoremove -y",
    "clean": "apt-get clean",
    "vacuum-logs": "journalctl --vacuum-time=7d",
    "purge-configs": "dpkg -l | grep '^rc' | awk '{print $2}' | xargs -r dpkg --purge",
    "docker-prune": "docker system prune -f",
    "docker-volume-prune": "docker volume prune -f",
    "docker-builder-prune": "docker builder prune -a -f"
}

class MaintenanceTaskManager:
    def __init__(self):
        self.active_task = None
        self.lock = threading.Lock()
        
        # Persistent storage for task logs
        if os.path.exists("/app/data"):
            self.logs_dir = "/app/data/maintenance_logs"
        else:
            self.logs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../maintenance_logs"))
            
        os.makedirs(self.logs_dir, exist_ok=True)

    def get_log_path(self, task_id):
        return os.path.join(self.logs_dir, f"{task_id}.log")

    def start_task(self, task_id, cmd):
        with self.lock:
            # Check if there is an active running task
            if self.active_task and self.active_task.get("status") == "running":
                return False, "Un'altra attività di manutenzione è già in corso."

            self.active_task = {
                "task_id": task_id,
                "status": "running",
                "success": None,
                "start_time": datetime.datetime.now().isoformat()
            }
            
            # Clear previous log file
            log_path = self.get_log_path(task_id)
            with open(log_path, "w", encoding="utf-8") as f:
                f.write(f"=== Starting maintenance task: {task_id} ===\n\n")

            # Start thread
            thread = threading.Thread(target=self._run_task, args=(task_id, cmd))
            thread.daemon = True
            thread.start()
            return True, "Attività avviata."

    def _run_task(self, task_id, cmd):
        log_path = self.get_log_path(task_id)
        
        full_cmd = cmd
        if Config.IN_DOCKER:
            full_cmd = f"nsenter --target 1 --mount --uts --ipc --net --pid -- /bin/bash -c {shlex.quote(cmd)}"

        try:
            with open(log_path, "a", encoding="utf-8", buffering=1) as log_file:
                process = subprocess.Popen(
                    full_cmd,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )
                
                for line in iter(process.stdout.readline, ""):
                    log_file.write(line)
                    log_file.flush()
                    
                process.stdout.close()
                returncode = process.wait()
                
                full_output = ""
                if os.path.exists(log_path):
                    with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                        full_output = f.read()

                # Auto-repair if dpkg was interrupted
                if returncode != 0 and "dpkg was interrupted" in full_output:
                    log_file.write("\n[Auto-Fix] Rilevato blocco dpkg. Esecuzione di dpkg --configure -a in corso...\n")
                    log_file.flush()
                    
                    repair_cmd = "systemd-run --description='EasyLin Dpkg Recovery' dpkg --configure -a"
                    if Config.IN_DOCKER:
                        repair_cmd = f"nsenter --target 1 --mount --uts --ipc --net --pid -- {repair_cmd}"
                        
                    repair_proc = subprocess.Popen(
                        repair_cmd,
                        shell=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        bufsize=1,
                        universal_newlines=True
                    )
                    
                    for line in iter(repair_proc.stdout.readline, ""):
                        log_file.write(f"[Auto-Fix] {line}")
                        log_file.flush()
                        
                    repair_proc.stdout.close()
                    repair_rc = repair_proc.wait()
                    
                    if repair_rc == 0:
                        log_file.write("\n[Auto-Fix] Ripristino completato con successo! Riavvio del comando originale...\n\n")
                        log_file.flush()
                        
                        # Riprova il comando originale dopo il fix
                        process2 = subprocess.Popen(
                            full_cmd,
                            shell=True,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT,
                            text=True,
                            bufsize=1,
                            universal_newlines=True
                        )
                        
                        for line in iter(process2.stdout.readline, ""):
                            log_file.write(line)
                            log_file.flush()
                            
                        process2.stdout.close()
                        returncode = process2.wait()
                    else:
                        log_file.write("\n[Auto-Fix Failed] Tentativo di ripristino automatico fallito.\n")
                        log_file.flush()
                
                success = (returncode == 0)
                
            with self.lock:
                if self.active_task and self.active_task["task_id"] == task_id:
                    self.active_task["status"] = "done"
                    self.active_task["success"] = success
                    self.active_task["end_time"] = datetime.datetime.now().isoformat()
                    
        except Exception as e:
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(f"\nExecution error: {str(e)}\n")
            except:
                pass
            with self.lock:
                if self.active_task and self.active_task["task_id"] == task_id:
                    self.active_task["status"] = "done"
                    self.active_task["success"] = False
                    self.active_task["end_time"] = datetime.datetime.now().isoformat()

    def get_status(self, task_id):
        with self.lock:
            log_path = self.get_log_path(task_id)
            log_content = ""
            if os.path.exists(log_path):
                try:
                    with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                        log_content = f.read()
                except Exception as e:
                    log_content = f"Error reading log file: {str(e)}"
            
            is_running = (self.active_task and self.active_task["task_id"] == task_id and self.active_task["status"] == "running")
            success = self.active_task["success"] if (self.active_task and self.active_task["task_id"] == task_id) else None
            
            return {
                "task_id": task_id,
                "running": is_running,
                "success": success,
                "stdout": log_content
            }

task_manager = MaintenanceTaskManager()
