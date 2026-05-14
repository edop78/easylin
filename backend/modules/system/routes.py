from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import socket
import platform
import distro
import psutil
import datetime
import os
import sys

system_bp = Blueprint("system", __name__)

# Import robusto
try:
    from backend.utils.command import run_host_command
except ImportError:
    try:
        from utils.command import run_host_command
    except ImportError:
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
        from backend.utils.command import run_host_command

@system_bp.route("/info", methods=["GET"])
@jwt_required()
def system_info():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except:
        local_ip = "N/A"

    res_pub = run_host_command("curl -s --connect-timeout 2 https://api.ipify.org")
    public_ip = res_pub.get("stdout", "").strip() if res_pub.get("returncode") == 0 else "N/A"
    
    res_virt = run_host_command("systemd-detect-virt")
    virt = res_virt.get("stdout", "physical").strip() if res_virt.get("returncode") == 0 else "physical"
    
    try:
        bt = datetime.datetime.fromtimestamp(psutil.boot_time()).strftime("%Y-%m-%d %H:%M:%S")
    except:
        bt = "N/A"

    res_up = run_host_command("uptime -p")
    uptime = res_up.get("stdout", "N/A").strip().replace("up ", "") if res_up.get("returncode") == 0 else "N/A"

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
