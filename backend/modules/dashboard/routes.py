from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
import psutil
import docker
from backend.utils.command import run_host_command

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/metrics")
@jwt_required()
def get_metrics():
    # CPU & Load
    cpu_percent = psutil.cpu_percent(interval=None)
    load_avg = psutil.getloadavg()
    
    # RAM
    virtual_mem = psutil.virtual_memory()
    ram = {
        "percent": virtual_mem.percent,
        "used": virtual_mem.used,
        "free": virtual_mem.available,
        "total": virtual_mem.total
    }
    
    # DISK
    disk_usage = psutil.disk_usage('/')
    disk = {
        "percent": disk_usage.percent,
        "used": disk_usage.used,
        "free": disk_usage.free,
        "total": disk_usage.total
    }
    
    # DOCKER OVERVIEW
    docker_info = {"running": 0, "total": 0, "error": None}
    try:
        client = docker.from_env()
        containers = client.containers.list(all=True)
        docker_info["total"] = len(containers)
        docker_info["running"] = len([c for c in containers if c.status == 'running'])
    except Exception as e:
        docker_info["error"] = str(e)
    
    # SERVICE STATUS
    services = []
    monitored = ["docker", "ssh", "ufw", "nginx"]
    for s in monitored:
        res = run_host_command(f"systemctl is-active {s}")
        services.append({
            "name": s.upper() if s != 'ufw' else 'Firewall (UFW)',
            "status": res["stdout"].strip() if res["returncode"] == 0 else "inactive"
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
