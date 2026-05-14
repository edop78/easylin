from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
import psutil
from backend.utils.command import run_host_command

dashboard_bp = Blueprint("dashboard", __name__)

def safe_int(value):
    try:
        return int(str(value).strip())
    except:
        return 0

@dashboard_bp.route("/metrics")
@jwt_required()
def get_metrics():
    # RAM
    try:
        vm = psutil.virtual_memory()
        ram = {"percent": vm.percent, "used": vm.used, "free": vm.available, "total": vm.total}
    except:
        ram = {"percent": 0, "used": 0, "free": 0, "total": 0}
    
    # Disk
    try:
        du = psutil.disk_usage('/')
        disk = {"percent": du.percent, "used": du.used, "free": du.free, "total": du.total}
    except:
        disk = {"percent": 0, "used": 0, "free": 0, "total": 0}
    
    # Docker Overview (Safe Parsing)
    res_total = run_host_command("docker ps -a -q | wc -l")
    res_running = run_host_command("docker ps -q | wc -l")
    
    docker_info = {
        "total": safe_int(res_total["stdout"]),
        "running": safe_int(res_running["stdout"])
    }
    
    # Services
    services = []
    for s in ["docker", "ssh", "ufw"]:
        res = run_host_command(f"systemctl is-active {s}")
        services.append({
            "name": s.upper() if s != 'ufw' else 'Firewall (UFW)',
            "status": res["stdout"].strip() if res["returncode"] == 0 else "inactive"
        })

    # Load
    try:
        load = psutil.getloadavg()
    except:
        load = [0, 0, 0]

    return jsonify({
        "cpu": psutil.cpu_percent(),
        "load": load,
        "ram": ram,
        "disk": disk,
        "docker": docker_info,
        "services": services,
        "net": {"sent": psutil.net_io_counters().bytes_sent, "recv": psutil.net_io_counters().bytes_recv}
    })
