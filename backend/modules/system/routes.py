from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import socket
import platform
import psutil
import datetime
import os
import sys
import json
import subprocess
import shlex
try:
    from config import Config
except ImportError:
    from backend.config import Config

system_bp = Blueprint("system", __name__)

@system_bp.route("/version", methods=["GET"])
@jwt_required()
def get_version():
    try:
        # Il file ora si trova in backend/version.json
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
        version_file = os.path.join(root_dir, "version.json")
        
        # Default values
        major, minor, patch, build = 1, 1, 0, 0
        label = "stable"
        
        # 1. Carica dati dal file
        if os.path.exists(version_file):
            with open(version_file, 'r') as f:
                v = json.load(f)
                major = v.get('major', major)
                minor = v.get('minor', minor)
                patch = v.get('patch', patch)
                build = v.get('build', build)
                label = v.get('label', label)
        
        # 2. Tenta di usare Git per la patch (se disponibile e siamo in un repo)
        res = run_host_command("git rev-list --count HEAD")
        if res.get("returncode") == 0:
            # Se siamo in locale con Git, la patch è il numero di commit
            git_count = int(res.get("stdout", "0").strip())
            # Usiamo il maggiore tra il build manuale e il git count per sicurezza
            patch = max(patch, git_count)
        
        return jsonify({
            "version": f"v{major}.{minor}.{patch}",
            "build": build,
            "label": label
        })
    except Exception as e:
        return jsonify({"version": "v1.1.0", "label": "error", "error": str(e)})

# Helper to import run_host_command safely
def get_run_command():
    try:
        from backend.utils.command import run_host_command
        return run_host_command
    except ImportError:
        try:
            from utils.command import run_host_command
            return run_host_command
        except ImportError:
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
            try:
                from backend.utils.command import run_host_command
                return run_host_command
            except:
                return lambda cmd, **kwargs: {"stdout": "", "stderr": "Command utility not found", "returncode": 1}

run_host_command = get_run_command()

@system_bp.route("/info", methods=["GET"])
@jwt_required()
def system_info():
    # Local IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except:
        local_ip = "N/A"

    # Public IP
    try:
        res_pub = run_host_command("curl -s --connect-timeout 2 https://api.ipify.org")
        public_ip = res_pub.get("stdout", "").strip() if res_pub and res_pub.get("returncode") == 0 else "N/A"
    except:
        public_ip = "N/A"
    
    # Virtualization
    try:
        res_virt = run_host_command("systemd-detect-virt")
        virt = res_virt.get("stdout", "physical").strip() if res_virt and res_virt.get("returncode") == 0 else "physical"
    except:
        virt = "physical"
    
    # Boot time
    try:
        bt = datetime.datetime.fromtimestamp(psutil.boot_time()).strftime("%Y-%m-%d %H:%M:%S")
    except:
        bt = "N/A"

    # Uptime
    try:
        res_up = run_host_command("uptime -p")
        uptime = res_up.get("stdout", "N/A").strip().replace("up ", "") if res_up and res_up.get("returncode") == 0 else "N/A"
    except:
        uptime = "N/A"

    # OS Info
    os_name = "Linux"
    try:
        if os.path.exists("/etc/os-release"):
            with open("/etc/os-release") as f:
                for line in f:
                    if line.startswith("PRETTY_NAME="):
                        os_name = line.split("=")[1].strip().replace('"', '')
                        break
    except:
        os_name = platform.system()

    # CPU Temperature
    temp = None
    try:
        # Metodo standard Linux sysfs
        for i in range(10):
            path = f"/sys/class/thermal/thermal_zone{i}/type"
            if os.path.exists(path):
                with open(path, 'r') as f:
                    if 'pkg_temp' in f.read() or 'cpu' in f.read().lower():
                        with open(f"/sys/class/thermal/thermal_zone{i}/temp", 'r') as tf:
                            temp = int(tf.read().strip()) / 1000.0
                            break
        if temp is None and hasattr(psutil, "sensors_temperatures"):
            temps = psutil.sensors_temperatures()
            if 'coretemp' in temps:
                temp = temps['coretemp'][0].current
    except:
        temp = None

    # NTP & Timezone
    timezone = "UTC"
    ntp_active = False
    try:
        res_time = run_host_command("timedatectl show --property=Timezone,NTP")
        time_data = res_time.get("stdout", "")
        for line in time_data.split("\n"):
            if line.startswith("Timezone="):
                timezone = line.split("=")[1]
            if line.startswith("NTP="):
                ntp_active = line.split("=")[1] == "yes"
    except:
        pass

    # Active Sessions (SSH/Local)
    sessions = []
    try:
        for user in psutil.users():
            sessions.append({
                "name": user.name,
                "terminal": user.terminal,
                "host": user.host,
                "started": datetime.datetime.fromtimestamp(user.started).strftime("%Y-%m-%d %H:%M")
            })
    except:
        pass

    # Fallback: se siamo in Docker o psutil.users() non rileva sessioni,
    # eseguiamo il comando 'who' sull'host per intercettare gli accessi reali (SSH/locali)
    if not sessions:
        try:
            res_who = run_host_command("who")
            if res_who.get("returncode") == 0 and res_who.get("stdout"):
                for line in res_who["stdout"].split("\n"):
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split()
                    if len(parts) >= 4:
                        name = parts[0]
                        terminal = parts[1]
                        started_date = parts[2]
                        started_time = parts[3]
                        # Opzionale: l'host o IP remoto è solitamente racchiuso tra parentesi alla fine
                        host = ""
                        if len(parts) >= 5:
                            host = parts[4].strip("()")
                        
                        sessions.append({
                            "name": name,
                            "terminal": terminal,
                            "host": host or "localhost",
                            "started": f"{started_date} {started_time}"
                        })
        except:
            pass

    # Get Timezone
    try:
        res_tz = run_host_command("timedatectl show --property=Timezone --value")
        timezone = res_tz.get("stdout", "UTC").strip()
    except:
        timezone = "UTC"

    return jsonify({
        "hostname": socket.gethostname(),
        "os": os_name,
        "kernel": platform.release(),
        "arch": platform.machine(),
        "uptime": uptime,
        "cpu_count": psutil.cpu_count(),
        "cpu_temp": temp,
        "local_ip": local_ip,
        "public_ip": public_ip,
        "virtualization": virt,
        "boot_time": bt,
        "timezone": timezone,
        "ntp_active": ntp_active,
        "active_sessions": sessions
    })

@system_bp.route("/time/info", methods=["GET"])
@jwt_required()
def get_time_info():
    now = datetime.datetime.now()
    try:
        res_time = run_host_command("timedatectl show --property=Timezone,NTP,NTPSynchronized")
        time_data = {}
        for line in res_time.get("stdout", "").split("\n"):
            if "=" in line:
                k, v = line.split("=", 1)
                time_data[k] = v
    except:
        time_data = {"Timezone": "UTC", "NTP": "no", "NTPSynchronized": "no"}
        
    return jsonify({
        "current_time": now.strftime("%Y-%m-%d %H:%M:%S"),
        "timezone": time_data.get("Timezone"),
        "ntp_active": time_data.get("NTP") == "yes",
        "ntp_synchronized": time_data.get("NTPSynchronized") == "yes"
    })

@system_bp.route("/time/list-timezones", methods=["GET"])
@jwt_required()
def list_timezones():
    res = run_host_command("timedatectl list-timezones")
    zones = res.get("stdout", "").strip().split("\n")
    return jsonify(zones)

@system_bp.route("/time/set-timezone", methods=["POST"])
@jwt_required()
def set_timezone():
    data = request.get_json()
    tz = data.get("timezone")
    if not tz:
        return jsonify({"success": False, "error": "No timezone provided"}), 400
    res = run_host_command(f"timedatectl set-timezone {tz}")
    return jsonify({"success": res.get("returncode") == 0, "message": f"Timezone set to {tz}"})

@system_bp.route("/time/sync", methods=["POST"])
@jwt_required()
def sync_time():
    # Attiva NTP se disattivato
    run_host_command("timedatectl set-ntp true")
    # Tenta un restart di systemd-timesyncd per forzare
    res = run_host_command("systemctl restart systemd-timesyncd")
    return jsonify({"success": res.get("returncode") == 0, "message": "Time synchronization requested"})

@system_bp.route("/power/status", methods=["GET"])
@jwt_required()
def get_power_status():
    scheduled_file = "/run/systemd/shutdown/scheduled"
    if os.path.exists(scheduled_file):
        try:
            with open(scheduled_file, 'r') as f:
                content = f.read()
                # Il file contiene USEC=... e ACTION=...
                data = {}
                for line in content.split("\n"):
                    if "=" in line:
                        k, v = line.split("=", 1)
                        data[k] = v
                
                # Convertiamo USEC (microsecondi da epoca) in data leggibile
                usec = int(data.get("USEC", 0))
                dt = datetime.datetime.fromtimestamp(usec / 1000000)
                return jsonify({
                    "active": True,
                    "action": data.get("ACTION", "shutdown"),
                    "time": dt.strftime("%Y-%m-%d %H:%M:%S"),
                    "timestamp": usec / 1000000
                })
        except:
            pass
    return jsonify({"active": False})

@system_bp.route("/power/cancel", methods=["POST"])
@jwt_required()
def cancel_power():
    res = run_host_command("shutdown -c")
    return jsonify({"success": res.get("returncode") == 0, "message": "Scheduled operation cancelled"})

@system_bp.route("/power", methods=["POST"])
@jwt_required()
def power_action():
    data = request.get_json()
    action = data.get("action") # reboot or shutdown
    mode = data.get("mode", "delay") # delay, time, cron
    
    if action not in ["reboot", "shutdown"]:
        return jsonify({"success": False, "error": "Invalid action"}), 400
    
    flag = "-r" if action == "reboot" else "-h"
    
    if mode == "delay":
        delay = data.get("delay", 0)
        time_arg = f"+{delay}" if delay > 0 else "now"
        cmd = f"shutdown {flag} {time_arg}"
    elif mode == "time":
        target_time = data.get("time") # HH:MM
        cmd = f"shutdown {flag} {target_time}"
    elif mode == "cron":
        cron_expr = data.get("cron") # e.g. "0 3 * * 0" (ogni domenica alle 3)
        # Per cron dobbiamo creare un job che esegua reboot/shutdown
        system_cmd = "reboot" if action == "reboot" else "shutdown -h now"
        # Usiamo un commento identificativo per poterlo rimuovere in futuro se necessario
        cron_line = f"{cron_expr} root {system_cmd} # EASYLIN_POWER_JOB"
        # Aggiungiamo al crontab di sistema o in /etc/cron.d/easylin_power
        cmd = f'echo "{cron_line}" > /etc/cron.d/easylin_power_{action}'
    else:
        return jsonify({"success": False, "error": "Invalid mode"}), 400
    
    res = run_host_command(cmd)
    return jsonify({
        "success": res.get("returncode") == 0,
        "message": f"Power action {action} scheduled successfully",
        "stdout": res.get("stdout"),
        "stderr": res.get("stderr")
    })

@system_bp.route("/reboot", methods=["POST"])
@jwt_required()
def reboot():
    res = run_host_command("reboot")
    return jsonify(res)

@system_bp.route("/shutdown", methods=["POST"])
@jwt_required()
def shutdown():
    res = run_host_command("shutdown -h now")
    return jsonify(res)

@system_bp.route("/maintenance", methods=["POST"])
@jwt_required()
def maintenance_action():
    """Handle all tasks from the Update & Clean page."""
    data = request.get_json()
    command_id = data.get("command")
    
    commands = {
        # Updates
        "update": "DEBIAN_FRONTEND=noninteractive apt-get update",
        "upgrade": "DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -o Dpkg::Options::=\"--force-confdef\" -o Dpkg::Options::=\"--force-confold\"",
        "full-upgrade": "DEBIAN_FRONTEND=noninteractive apt-get full-upgrade -y -o Dpkg::Options::=\"--force-confdef\" -o Dpkg::Options::=\"--force-confold\"",
        "dist-upgrade": "DEBIAN_FRONTEND=noninteractive apt-get dist-upgrade -y -o Dpkg::Options::=\"--force-confdef\" -o Dpkg::Options::=\"--force-confold\"",
        "fix-broken": "DEBIAN_FRONTEND=noninteractive apt-get install -f -y -o Dpkg::Options::=\"--force-confdef\" -o Dpkg::Options::=\"--force-confold\"",
        "fix-dpkg": "dpkg --configure -a",
        "release-upgrade": "do-release-upgrade -f DistUpgradeViewNonInteractive",
        "release-upgrade-dev": "do-release-upgrade -d -f DistUpgradeViewNonInteractive",
        
        # Cleaning
        "autoremove": "DEBIAN_FRONTEND=noninteractive apt-get autoremove -y",
        "clean": "apt-get clean",
        "vacuum-logs": "journalctl --vacuum-time=7d",
        "purge-configs": "dpkg -l | grep '^rc' | awk '{print $2}' | xargs -r dpkg --purge",
        "docker-prune": "docker system prune -f"
    }
    
    cmd = commands.get(command_id)
    if not cmd:
        return jsonify({"success": False, "stderr": f"Unknown command: {command_id}"}), 400
        
    res = run_host_command(cmd)

    # Auto-repair if dpkg was interrupted (common Debian/Ubuntu package manager lock/crash issue)
    err_msg = (res.get("stderr") or "") + (res.get("stdout") or "")
    if res.get("returncode") != 0 and "dpkg was interrupted" in err_msg:
        # Tenta di eseguire dpkg --configure -a in automatico sull'host
        repair_res = run_host_command("dpkg --configure -a")
        if repair_res.get("returncode") == 0:
            # Riprova il comando originale dopo il fix
            res = run_host_command(cmd)
            # Aggiunge una nota informativa all'output
            res["stdout"] = f"[Auto-Fix] Rilevato blocco 'dpkg was interrupted'. Risolto automaticamente con 'dpkg --configure -a'.\n\n" + (res.get("stdout") or "")
        else:
            # Se anche il ripristino automatico fallisce, segnalalo con i dettagli per aiutare la diagnostica
            res["stderr"] = (res.get("stderr") or "") + f"\n\n[Auto-Fix Failed] Tentativo di ripristino automatico fallito:\n{repair_res.get('stderr') or repair_res.get('stdout')}"
            
    # Ensure result has success field for frontend
    res["success"] = res.get("returncode") == 0
    return jsonify(res)

import threading

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
    "docker-prune": "docker system prune -f"
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
                    
                    repair_cmd = "dpkg --configure -a"
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

@system_bp.route("/maintenance/start", methods=["POST"])
@jwt_required()
def maintenance_start():
    """Start a maintenance task in a background worker thread."""
    data = request.get_json()
    command_id = data.get("command")
    
    cmd = MAINTENANCE_COMMANDS.get(command_id)
    if not cmd:
        return jsonify({"success": False, "error": f"Unknown command: {command_id}"}), 400
        
    started, message = task_manager.start_task(command_id, cmd)
    if not started:
        return jsonify({"success": False, "error": message}), 409
        
    return jsonify({"success": True, "message": message})

@system_bp.route("/maintenance/status/<task_id>", methods=["GET"])
@jwt_required()
def maintenance_status(task_id):
    """Retrieve status and stdout logs of a background maintenance task."""
    status = task_manager.get_status(task_id)
    return jsonify(status)

@system_bp.route("/apt-clean", methods=["POST"])
@jwt_required()
def apt_clean():
    res = run_host_command("apt-get clean && apt-get autoremove -y")
    return jsonify(res)

@system_bp.route("/docker-prune", methods=["POST"])
@jwt_required()
def docker_prune():
    res = run_host_command("docker system prune -f")
    return jsonify(res)
