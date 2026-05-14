from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
import psutil
from backend.utils.command import run_host_command

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/metrics")
@jwt_required()
def get_metrics():
    # RAM
    vm = psutil.virtual_memory()
    ram = {"percent": vm.percent, "used": vm.used, "free": vm.available, "total": vm.total}
    
    # Disk
    du = psutil.disk_usage('/')
    disk = {"percent": du.percent, "used": du.used, "free": du.free, "total": du.total}
    
    # Docker Overview (Uso comandi shell per sicurezza totale)
    res_total = run_host_command("docker ps -a -q | wc -l")
    res_running = run_host_command("docker ps -q | wc -l")
    
    docker_info = {
        "total": int(res_total["stdout"].strip() or 0),
        "running": int(res_running["stdout"].strip() or 0)
    }
    
    # Services
    services = []
    for s in ["docker", "ssh", "ufw"]:
        res = run_host_command(f"systemctl is-active {s}")
        services.append({
            "name": s.upper() if s != 'ufw' else 'Firewall (UFW)',
            "status": res["stdout"].strip() if res["returncode"] == 0 else "inactive"
        })

    return jsonify({
        "cpu": psutil.cpu_percent(),
        "load": psutil.getloadavg(),
        "ram": ram,
        "disk": disk,
        "docker": docker_info,
        "services": services,
        "net": {"sent": psutil.net_io_counters().bytes_sent, "recv": psutil.net_io_counters().bytes_recv}
    })
