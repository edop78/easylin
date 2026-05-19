from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
import psutil
import docker
import os
import sys

dashboard_bp = Blueprint("dashboard", __name__)

import logging
from utils.command import run_host_command

logger = logging.getLogger(__name__)


@dashboard_bp.route("/metrics", methods=["GET"])
@jwt_required()
def get_metrics():
    """Get system metrics for dashboard."""
    try:
        # CPU - Intervallo più lungo per catturare la realtà
        cpu = psutil.cpu_percent(interval=0.5)
        
        # RAM - Arrotondamento "Umano" per il totale
        ram_obj = psutil.virtual_memory()
        # Se siamo vicini a un GB pieno, mostriamo quello per coerenza hardware
        total_gb = ram_obj.total / (1024**3)
        commercial_total = round(total_gb) if abs(total_gb - round(total_gb)) < 0.3 else total_gb
        
        ram = {
            "percent": ram_obj.percent,
            "used": ram_obj.used,
            "free": ram_obj.available,
            "total": ram_obj.total,
            "display_total": f"{commercial_total:.1f} GB" if commercial_total % 1 != 0 else f"{int(commercial_total)} GB"
        }
        
        # Disk - Calcolo dello spazio reale senza arrotondamenti commerciali
        disk_obj = psutil.disk_usage('/')
        total_disk_gb = disk_obj.total / (1024**3)
        
        disk = {
            "percent": disk_obj.percent,
            "used": disk_obj.used,
            "free": disk_obj.free,
            "total": disk_obj.total,
            "display_total": f"{total_disk_gb:.1f} GB"
        }
        
        # Network
        net_io = psutil.net_io_counters()
        net = {
            "sent": net_io.bytes_sent,
            "recv": net_io.bytes_recv
        }
        
        # Load Average
        load = os.getloadavg() if hasattr(os, 'getloadavg') else [0, 0, 0]
        
        # Docker stats
        docker_stats = {"running": 0, "total": 0}
        try:
            client = docker.from_env()
            containers = client.containers.list(all=True)
            docker_stats["total"] = len(containers)
            docker_stats["running"] = len([c for c in containers if c.status == "running"])
        except:
            pass

        # Check for system updates (simulated/cached check)
        updates_count = 0
        security_updates = 0
        try:
            # On Debian/Ubuntu, we can check for the existence of this file which is updated by apt
            # or run a quick simulation. Simulation is more accurate.
            res = run_host_command("apt-get -s upgrade | grep '^Inst' | wc -l")
            if res.get("returncode") == 0:
                updates_count = int(res.get("stdout", "0").strip())
        except:
            pass

        return jsonify({
            "cpu": cpu,
            "ram": ram,
            "disk": disk,
            "net": net,
            "load": load,
            "docker": docker_stats,
            "updates": {
                "total": updates_count,
                "security": security_updates # Could be refined further if needed
            }
        })
    except Exception as e:
        logger.exception("Error gathering dashboard metrics")
        return jsonify({"error": str(e)}), 500
