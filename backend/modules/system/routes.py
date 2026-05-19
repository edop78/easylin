from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import socket
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

from .services import (
    get_container_id,
    get_project_dir,
    get_temp_status_path,
    get_system_info_data,
    run_host_command
)
from .tasks import task_manager, MAINTENANCE_COMMANDS

system_bp = Blueprint("system", __name__)

@system_bp.route("/version", methods=["GET"])
@jwt_required()
def get_version():
    try:
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
        version_file = os.path.join(root_dir, "version.json")
        
        # Default values
        major, minor, patch, build = 1, 3, 0, 112
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
        
        # 2. Tenta di trovare la directory del progetto
        project_dir = get_project_dir()
        
        # 3. Tenta di usare Git per il conteggio dei commit (patch) con safe.directory=*
        git_count = None
        if project_dir:
            git_cmd = f"git -c safe.directory=* -C {shlex.quote(project_dir)} rev-list --count HEAD"
            git_res = run_host_command(git_cmd)
            if git_res.get("returncode") == 0:
                try:
                    git_count = int(git_res.get("stdout", "0").strip())
                except ValueError:
                    pass

        # Fallback locale se non rilevato
        if git_count is None:
            try:
                res = subprocess.run(
                    ["git", "-c", "safe.directory=*", "rev-list", "--count", "HEAD"],
                    capture_output=True,
                    text=True,
                    cwd=root_dir,
                    timeout=3
                )
                if res.returncode == 0:
                    git_count = int(res.stdout.strip())
            except Exception:
                pass
                
        if git_count is not None:
            patch = git_count
        
        return jsonify({
            "version": f"v{major}.{minor}.{patch}",
            "build": build,
            "label": label
        })
    except Exception as e:
        return jsonify({"version": "v1.4.0", "label": "error", "error": str(e)})

@system_bp.route("/info", methods=["GET"])
@jwt_required()
def system_info():
    return jsonify(get_system_info_data())

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
                data = {}
                for line in content.split("\n"):
                    if "=" in line:
                        k, v = line.split("=", 1)
                        data[k] = v
                
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
        cron_expr = data.get("cron")
        system_cmd = "reboot" if action == "reboot" else "shutdown -h now"
        cron_line = f"{cron_expr} root {system_cmd} # EASYLIN_POWER_JOB"
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
    """Handle all tasks from the Update & Clean page (Synchronous)."""
    data = request.get_json()
    command_id = data.get("command")
    
    cmd = MAINTENANCE_COMMANDS.get(command_id)
    if not cmd:
        return jsonify({"success": False, "stderr": f"Unknown command: {command_id}"}), 400
        
    res = run_host_command(cmd)

    err_msg = (res.get("stderr") or "") + (res.get("stdout") or "")
    if res.get("returncode") != 0 and "dpkg was interrupted" in err_msg:
        repair_res = run_host_command("systemd-run --description='EasyLin Dpkg Recovery' dpkg --configure -a")
        if repair_res.get("returncode") == 0:
            res = run_host_command(cmd)
            res["stdout"] = f"[Auto-Fix] Rilevato blocco 'dpkg was interrupted'. Risolto automaticamente con 'dpkg --configure -a'.\n\n" + (res.get("stdout") or "")
        else:
            res["stderr"] = (res.get("stderr") or "") + f"\n\n[Auto-Fix Failed] Tentativo di ripristino automatico fallito:\n{repair_res.get('stderr') or repair_res.get('stdout')}"
            
    res["success"] = res.get("returncode") == 0
    return jsonify(res)

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

@system_bp.route("/update/check", methods=["GET"])
@jwt_required()
def check_update():
    try:
        # Clean up old status file if completed/failed
        status_path = get_temp_status_path()
        if os.path.exists(status_path):
            try:
                with open(status_path, "r") as f:
                    data = json.load(f)
                if data.get("step") in ["completed", "failed"]:
                    os.remove(status_path)
            except:
                pass

        # Get project working directory
        project_dir = get_project_dir()
        
        if not project_dir:
            return jsonify({
                "update_available": False,
                "commits_behind": 0,
                "changelog": [],
                "error": "Could not determine project working directory on host"
            })
            
        # 1. Fetch remote updates on the host with safe.directory override
        fetch_cmd = f"git -c safe.directory=* -C {shlex.quote(project_dir)} fetch origin main"
        run_host_command(fetch_cmd)
        
        # 2. Count commits behind
        count_cmd = f"git -c safe.directory=* -C {shlex.quote(project_dir)} rev-list --count HEAD..FETCH_HEAD"
        count_res = run_host_command(count_cmd)
        
        commits_behind = 0
        if count_res.get("returncode") == 0:
            try:
                commits_behind = int(count_res.get("stdout", "0").strip())
            except ValueError:
                pass
                
        # 3. Retrieve changelog (latest commit messages)
        changelog = []
        if commits_behind > 0:
            log_cmd = f"git -c safe.directory=* -C {shlex.quote(project_dir)} log -n 5 --oneline HEAD..FETCH_HEAD"
            log_res = run_host_command(log_cmd)
            if log_res.get("returncode") == 0:
                changelog = [line.strip() for line in log_res.get("stdout", "").strip().split("\n") if line.strip()]
                
        return jsonify({
            "update_available": commits_behind > 0,
            "commits_behind": commits_behind,
            "changelog": changelog
        })
    except Exception as e:
        return jsonify({
            "update_available": False,
            "commits_behind": 0,
            "changelog": [],
            "error": str(e)
        })

@system_bp.route("/update/run", methods=["POST"])
@jwt_required()
def run_update():
    try:
        # Get project working directory
        project_dir = get_project_dir()
        
        if not project_dir:
            return jsonify({"success": False, "error": "Could not determine project working directory on host"}), 500
            
        # Clean any previous status/log file
        try:
            status_path = get_temp_status_path()
            if os.path.exists(status_path):
                os.remove(status_path)
            
            log_path = "/host/tmp/easylin_self_update.log" if getattr(Config, 'IN_DOCKER', False) else "/tmp/easylin_self_update.log"
            if os.path.exists(log_path):
                os.remove(log_path)
        except:
            pass
            
        # Prepare the bash script to execute on the host
        # We add "sleep 2" to let Flask return the success JSON response to the client first.
        script = f"""(
  echo '{{\"step\": \"git_pull\", \"progress\": 20, \"status\": \"running\"}}' > /tmp/easylin_update_status.json
  cd {shlex.quote(project_dir)}
  if ! git -c safe.directory=* pull origin main; then
    echo '{{\"step\": \"failed\", \"progress\": 20, \"error\": \"Git pull failed\"}}' > /tmp/easylin_update_status.json
    exit 1
  fi
  
  echo '{{\"step\": \"docker_build\", \"progress\": 60, \"status\": \"running\"}}' > /tmp/easylin_update_status.json
  if ! docker compose up -d --build; then
    echo '{{\"step\": \"failed\", \"progress\": 60, \"error\": \"Docker compose rebuild failed\"}}' > /tmp/easylin_update_status.json
    exit 1
  fi
  
  echo '{{\"step\": \"completed\", \"progress\": 100, \"status\": \"success\"}}' > /tmp/easylin_update_status.json
) > /tmp/easylin_self_update.log 2>&1"""

        # Launch via systemd-run on host, completely detached
        escaped_script = shlex.quote(f"sleep 2 && {script}")
        run_cmd = f"systemd-run --unit=easylin-self-update --description='EasyLin Self-Update' /bin/bash -c {escaped_script}"
        
        # Stop any existing update job if running
        run_host_command("systemctl stop easylin-self-update || true")
        res = run_host_command(run_cmd)
        
        if res.get("returncode") == 0:
            # Write initial state so frontend immediately knows it started
            try:
                os.makedirs(os.path.dirname(get_temp_status_path()), exist_ok=True)
                with open(get_temp_status_path(), "w") as f:
                    f.write('{"step": "started", "progress": 5, "status": "running"}')
            except:
                pass
            return jsonify({"success": True, "message": "Update process started in background"})
        else:
            return jsonify({"success": False, "error": f"Failed to schedule systemd job: {res.get('stderr') or res.get('stdout')}"}), 500
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@system_bp.route("/update/status", methods=["GET"])
@jwt_required()
def get_update_status():
    path = get_temp_status_path()
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                data = json.load(f)
            return jsonify(data)
        except Exception as e:
            return jsonify({"step": "error", "progress": 0, "error": str(e)})
    return jsonify({"step": "idle", "progress": 0, "status": "idle"})
