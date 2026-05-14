from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
import psutil
from backend.utils.command import run_host_command

dashboard_bp = Blueprint("dashboard", __name__)

def safe_int(value):
    try:
        # Pulisce la stringa da eventuali caratteri non numerici
        digit_only = "".join(filter(str.isdigit, str(value)))
        return int(digit_only) if digit_only else 0
    except:
        return 0

@dashboard_bp.route("/metrics")
@jwt_required()
def get_metrics():
    # CPU (usiamo un piccolo intervallo per avere un dato reale)
    cpu_percent = psutil.cpu_percent(interval=0.1)
    load_avg = psutil.getloadavg()
    
    # RAM
    vm = psutil.virtual_memory()
    ram = {
        "percent": vm.percent,
        "used": vm.used,
        "free": vm.available,
        "total": vm.total
    }
    
    # DISK
    du = psutil.disk_usage('/')
    disk = {
        "percent": du.percent,
        "used": du.used,
        "free": du.free,
        "total": du.total
    }
    
    # DOCKER (Usiamo comandi shell sicuri)
    res_total = run_host_command("docker ps -a -q | wc -l")
    res_running = run_host_command("docker ps -q | wc -l")
    
    docker_info = {
        "total": safe_int(res_total.get("stdout", "0")),
        "running": safe_int(res_running.get("stdout", "0"))
    }
    
    # SERVICES
    services = []
    for s in ["docker", "ssh", "ufw"]:
        res = run_host_command(f"systemctl is-active {s}")
        services.append({
            "name": s.upper() if s != 'ufw' else 'Firewall (UFW)',
            "status": res.get("stdout", "inactive").strip() if res.get("returncode") == 0 else "inactive"
        })
    
    # NETWORK
    net_io = psutil.net_io_counters()
    net = {
        "sent": net_io.bytes_sent,
        "recv": net_io.bytes_recv
    }
    
    return jsonify({
        "cpu": cpu_percent,
        "load": load_avg,
        "ram": ram,
        "disk": disk,
        "docker": docker_info,
        "services": services,
        "net": net
    })
