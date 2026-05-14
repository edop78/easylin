from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import socket
import platform
import distro
import psutil
import datetime
import os
import sys

# Definizione Blueprint
system_bp = Blueprint("system", __name__)

# Import robusto per run_host_command
try:
    from backend.utils.command import run_host_command
except ImportError:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
    from backend.utils.command import run_host_command

@system_bp.route("/maintenance", methods=["POST"])
@jwt_required()
def run_maintenance():
    """Run a maintenance command (apt, release-upgrade)."""
    data = request.get_json()
    cmd_type = data.get("command")
    
    commands = {
        "update": "apt-get update",
        "upgrade": "apt-get upgrade -y",
        "full-upgrade": "apt-get full-upgrade -y",
        "dist-upgrade": "apt-get dist-upgrade -y",
        "autoremove": "apt-get autoremove -y",
        "clean": "apt-get clean",
        "fix-broken": "apt-get install -f -y",
        "fix-dpkg": "dpkg --configure -a",
        "vacuum-logs": "journalctl --vacuum-time=7d",
        "purge-configs": "dpkg -l | grep '^rc' | awk '{print $2}' | xargs -r apt-get purge -y",
        "release-upgrade": "do-release-upgrade -f DistUpgradeViewNonInteractive",
        "release-upgrade-dev": "do-release-upgrade -d -f DistUpgradeViewNonInteractive"
    }
    
    cmd = commands.get(cmd_type)
    if not cmd:
        return jsonify({"error": "Invalid command"}), 400
        
    res = run_host_command(cmd, timeout=600)
    
    return jsonify({
        "success": res["returncode"] == 0,
        "stdout": res["stdout"],
        "stderr": res["stderr"],
        "returncode": res["returncode"]
    })

@system_bp.route("/info", methods=["GET"])
@jwt_required()
def system_info():
    """Get comprehensive system info."""
    # Local IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except:
        local_ip = "N/A"

    # Public IP
    res_pub = run_host_command("curl -s https://api.ipify.org")
    public_ip = res_pub["stdout"].strip() if res_pub["returncode"] == 0 else "N/A"
    
    # Virtualization
    res_virt = run_host_command("systemd-detect-virt")
    virt = res_virt["stdout"].strip() if res_virt["returncode"] == 0 else "physical"
    
    # Boot time
    try:
        boot_time_timestamp = psutil.boot_time()
        bt = datetime.datetime.fromtimestamp(boot_time_timestamp).strftime("%Y-%m-%d %H:%M:%S")
    except:
        bt = "N/A"

    # Uptime
    res_uptime = run_host_command("uptime -p")
    uptime = res_uptime["stdout"].strip().replace("up ", "") if res_uptime["returncode"] == 0 else "N/A"

    return jsonify({
        "hostname": socket.gethostname(),
        "os": f"{distro.name()} {distro.version()}",
        "kernel": platform.release(),
        "arch": platform.machine(),
        "uptime": uptime,
        "cpu_count": psutil.cpu_count(),
        "local_ip": local_ip,
        "public_ip": public_ip,
        "virtualization": virt,
        "boot_time": bt,
        "python_version": platform.python_version()
    })

@system_bp.route("/reboot", methods=["POST"])
@jwt_required()
def reboot():
    run_host_command("reboot")
    return jsonify({"success": True})

@system_bp.route("/shutdown", methods=["POST"])
@jwt_required()
def shutdown():
    run_host_command("poweroff")
    return jsonify({"success": True})
