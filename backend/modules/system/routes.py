from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from backend.utils.command import run_host_command
import socket
import platform
import distro
import psutil
import datetime

system_bp = Blueprint("system", __name__)

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

    # Public IP (Safe check)
    res_pub = run_host_command("curl -s --connect-timeout 2 https://api.ipify.org")
    public_ip = res_pub["stdout"].strip() if res_pub["returncode"] == 0 else "N/A"
    
    # Virtualization
    res_virt = run_host_command("systemd-detect-virt")
    virt = res_virt["stdout"].strip() if res_virt["returncode"] == 0 else "physical"
    
    # Boot time
    try:
        bt = datetime.datetime.fromtimestamp(psutil.boot_time()).strftime("%Y-%m-%d %H:%M:%S")
    except:
        bt = "N/A"

    # Uptime
    res_up = run_host_command("uptime -p")
    uptime = res_up["stdout"].strip().replace("up ", "") if res_up["returncode"] == 0 else "N/A"

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
        "boot_time": bt
    })

@system_bp.route("/maintenance", methods=["POST"])
@jwt_required()
def run_maintenance():
    data = request.get_json()
    cmd_type = data.get("command")
    commands = {
        "update": "apt-get update", "upgrade": "apt-get upgrade -y", "autoremove": "apt-get autoremove -y", "clean": "apt-get clean"
    }
    cmd = commands.get(cmd_type)
    if not cmd: return jsonify({"error": "Invalid command"}), 400
    res = run_host_command(cmd, timeout=300)
    return jsonify({"success": res["returncode"] == 0, "stdout": res["stdout"], "stderr": res["stderr"]})
