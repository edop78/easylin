from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from backend.utils.command import run_host_command
import socket
import platform
import distro
import psutil
import datetime

system_bp = Blueprint("system", __name__)

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
    # Get local IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except:
        local_ip = "N/A"

    # Get Public IP (cached for speed)
    public_ip = run_host_command("curl -s https://api.ipify.org")["stdout"].strip() or "N/A"
    
    # Virtualization
    virt = run_host_command("systemd-detect-virt")["stdout"].strip() or "physical"
    
    # Boot time
    boot_time_timestamp = psutil.boot_time()
    bt = datetime.datetime.fromtimestamp(boot_time_timestamp).strftime("%Y-%m-%d %H:%M:%S")

    return jsonify({
        "hostname": socket.gethostname(),
        "os": f"{distro.name()} {distro.version()}",
        "kernel": platform.release(),
        "arch": platform.machine(),
        "uptime": run_host_command("uptime -p")["stdout"].strip().replace("up ", ""),
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
