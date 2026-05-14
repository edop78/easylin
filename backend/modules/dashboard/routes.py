from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
import psutil
import time

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/metrics")
@jwt_required()
def get_metrics():
    # CPU
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
        "net": net
    })
