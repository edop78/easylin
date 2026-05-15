from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import socket
import platform
import psutil
import datetime
import os
import sys
import json

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

    return jsonify({
        "hostname": socket.gethostname(),
        "os": os_name,
        "kernel": platform.release(),
        "arch": platform.machine(),
        "uptime": uptime,
        "cpu_count": psutil.cpu_count(),
        "local_ip": local_ip,
        "public_ip": public_ip,
        "virtualization": virt,
        "boot_time": bt
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
        "update": "apt-get update",
        "upgrade": "apt-get upgrade -y",
        "full-upgrade": "apt-get full-upgrade -y",
        "dist-upgrade": "apt-get dist-upgrade -y",
        "fix-broken": "apt-get install -f -y",
        "fix-dpkg": "dpkg --configure -a",
        "release-upgrade": "do-release-upgrade -f DistUpgradeViewNonInteractive",
        "release-upgrade-dev": "do-release-upgrade -d -f DistUpgradeViewNonInteractive",
        
        # Cleaning
        "autoremove": "apt-get autoremove -y",
        "clean": "apt-get clean",
        "vacuum-logs": "journalctl --vacuum-time=7d",
        "purge-configs": "dpkg -l | grep '^rc' | awk '{print $2}' | xargs -r dpkg --purge",
        "docker-prune": "docker system prune -f"
    }
    
    cmd = commands.get(command_id)
    if not cmd:
        return jsonify({"success": False, "stderr": f"Unknown command: {command_id}"}), 400
        
    res = run_host_command(cmd)
    # Ensure result has success field for frontend
    res["success"] = res.get("returncode") == 0
    return jsonify(res)

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
