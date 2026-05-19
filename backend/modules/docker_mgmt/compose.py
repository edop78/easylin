import os
import re
import shlex
import base64
import subprocess
import threading
from config import Config
from utils.command import run_host_command
from .tasks import update_task_db, LOG_FILE

def get_compose_projects(client):
    """List all docker-compose projects on the host."""
    # Create the compose root folder if it doesn't exist
    run_host_command("mkdir -p /opt/easylin/compose")
    
    # Find all compose files under /opt/easylin/compose/
    find_cmd = "find /opt/easylin/compose -maxdepth 2 -name 'docker-compose.ym*' 2>/dev/null"
    res = run_host_command(find_cmd)
    if res.get("returncode") != 0:
        return []
        
    stdout = res.get("stdout", "")
    paths = [p.strip() for p in stdout.split("\n") if p.strip()]
    
    containers = []
    if client:
        try:
            containers = client.containers.list(all=True)
        except:
            pass
            
    projects = []
    for path in paths:
        parts = path.split('/')
        if len(parts) >= 5:
            project_name = parts[-2]
            
            # Read content of compose file
            cat_res = run_host_command(f"cat {path}")
            yml_content = cat_res.get("stdout", "")
            
            # Find containers belonging to this project
            project_containers = []
            running_count = 0
            for c in containers:
                labels = c.attrs.get("Config", {}).get("Labels", {}) or {}
                c_proj = labels.get("com.docker.compose.project")
                if c_proj == project_name:
                    project_containers.append({
                        "id": c.short_id,
                        "name": c.name,
                        "status": c.status,
                        "state": c.attrs["State"]["Status"]
                    })
                    if c.status == "running":
                        running_count += 1
                        
            status = "stopped"
            if project_containers:
                if running_count == len(project_containers):
                    status = "running"
                elif running_count > 0:
                    status = "warning"
                else:
                    status = "stopped"
                    
            projects.append({
                "name": project_name,
                "path": path,
                "yml": yml_content,
                "status": status,
                "containers": project_containers
            })
            
    return projects

def run_async_compose_command(task_id, project_name, command, app, pre_run_cmd=None):
    """Run a compose command in a background thread and stream output to log file & database."""
    def run():
        with app.app_context():
            # 1. Initialize Log file
            try:
                with open(LOG_FILE, "w") as f:
                    f.write(f"--- Compose Command Started: {command} ---\n")
                    f.write(f"--- Project: {project_name} ---\n")
            except:
                pass
            
            update_task_db(task_id, status="installing", message="Executing compose command...", logs_list=[])
            
            # Run any preparatory commands (like writing compose files) on the host first
            if pre_run_cmd:
                pre_res = run_host_command(pre_run_cmd)
                if pre_res.get("returncode") != 0:
                    update_task_db(
                        task_id, 
                        status="error", 
                        message="Preparation command failed", 
                        error=pre_res.get("stderr"),
                        log_entry=f"PREPARATION ERROR: {pre_res.get('stderr')}"
                    )
                    return

            # 2. Formulate nsenter command if in Docker
            if Config.IN_DOCKER:
                full_cmd = (
                    f"nsenter --target 1 --mount --uts --ipc --net --pid "
                    f"-- /bin/bash -c {shlex.quote(command)}"
                )
            else:
                full_cmd = command
                
            try:
                process = subprocess.Popen(
                    full_cmd,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1
                )
                
                # 3. Stream output
                for line in iter(process.stdout.readline, ''):
                    clean_line = line.rstrip()
                    update_task_db(task_id, log_entry=clean_line)
                    
                process.stdout.close()
                returncode = process.wait()
                
                if returncode == 0:
                    update_task_db(task_id, status="success", message="Completed successfully", log_entry="Command executed successfully.")
                else:
                    update_task_db(task_id, status="error", message=f"Failed with exit code {returncode}", error=f"Exit code {returncode}")
            except Exception as e:
                update_task_db(task_id, status="error", message="Failed to execute command", error=str(e), log_entry=f"ERROR: {str(e)}")
                 
    thread = threading.Thread(target=run)
    thread.daemon = True
    thread.start()
