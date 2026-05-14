from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
import psutil
import os
import sys

# Definizione Blueprint
dashboard_bp = Blueprint("dashboard", __name__)

# Import robusto
try:
    from backend.utils.command import run_host_command
except ImportError:
    try:
        from utils.command import run_host_command
    except ImportError:
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
        from backend.utils.command import run_host_command

def safe_int(value):
    try:
        digit_only = "".join(filter(str.isdigit, str(value)))
        return int(digit_only) if digit_only else 0
    except:
        return 0

@dashboard_bp.route("/metrics")
@jwt_required()
def get_metrics():
    cpu_percent = psutil.cpu_percent(interval=0.1)
    load_avg = psutil.getloadavg()
    vm = psutil.virtual_memory()
    du = psutil.disk_usage('/')
    
    res_total = run_host_command("docker ps -a -q | wc -l")
    res_running = run_host_command("docker ps -q | wc -l")
    
    services = []
    for s in ["docker", "ssh", "ufw"]:
        res = run_host_command(f"systemctl is-active {s}")
        services.append({
            "name": s.upper() if s != 'ufw' else 'Firewall (UFW)',
            "status": res.get("stdout", "inactive").strip() if res.get("returncode") == 0 else "inactive"
        })
    
    net_io = psutil.net_io_counters()
    
    return jsonify({
        "cpu": cpu_percent,
        "load": load_avg,
        "ram": {"percent": vm.percent, "used": vm.used, "free": vm.available, "total": vm.total},
        "disk": {"percent": du.percent, "used": du.used, "free": du.free, "total": du.total},
        "docker": {"total": safe_int(res_total.get("stdout", "0")), "running": safe_int(res_running.get("stdout", "0"))},
        "services": services,
        "net": {"sent": net_io.bytes_sent, "recv": net_io.bytes_recv}
    })
