"""Dashboard API — system overview metrics."""

import psutil
import platform
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from utils.command import run_host_command

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/", methods=["GET"])
@jwt_required()
def overview():
    """Get system overview data."""
    # CPU
    cpu_percent = psutil.cpu_percent(interval=0.5)
    cpu_count = psutil.cpu_count()
    cpu_freq = psutil.cpu_freq()

    # Memory
    memory = psutil.virtual_memory()

    # Disk
    disk = psutil.disk_usage("/host" if __import__("os").path.exists("/host") else "/")

    # Uptime & hostname
    uptime_result = run_host_command("uptime -p")
    hostname_result = run_host_command("hostname")
    os_result = run_host_command("cat /etc/os-release | head -5")

    # Load average
    load = psutil.getloadavg()

    # Network IO
    net_io = psutil.net_io_counters()

    return jsonify({
        "cpu": {
            "percent": cpu_percent,
            "cores": cpu_count,
            "frequency": cpu_freq.current if cpu_freq else 0,
        },
        "memory": {
            "total": memory.total,
            "used": memory.used,
            "available": memory.available,
            "percent": memory.percent,
        },
        "disk": {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "percent": disk.percent,
        },
        "load_average": {
            "1min": load[0],
            "5min": load[1],
            "15min": load[2],
        },
        "network": {
            "bytes_sent": net_io.bytes_sent,
            "bytes_recv": net_io.bytes_recv,
        },
        "hostname": hostname_result.get("stdout", "unknown"),
        "uptime": uptime_result.get("stdout", "unknown"),
        "os_info": os_result.get("stdout", "unknown"),
        "platform": platform.machine(),
    })
