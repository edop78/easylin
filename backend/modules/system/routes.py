from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import socket
import platform
import psutil
import datetime
import os
import sys

system_bp = Blueprint("system", __name__)

# Funzione di aiuto per importare run_host_command in modo sicuro
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

    # OS Info - Usiamo /etc/os-release che è standard su Linux
    os_name = "Linux"
    try:
        if os.path.exists("/etc/os-release"):
            with open("/etc/os-release") as f:
                lines = f.readlines()
                for line in lines:
                    if line.startswith("PRETTY_NAME="):
                        os_name = line.split("=")[1].strip().replace('"', '')
                        break
        else:
            os_name = platform.system()
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
