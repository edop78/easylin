from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
import psutil
import docker
import os
import sys

dashboard_bp = Blueprint("dashboard", __name__)

# Helper to import run_host_command safely
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

@dashboard_bp.route("/metrics", methods=["GET"])
@jwt_required()
def get_metrics():
    """Get system metrics for dashboard."""
    try:
        # CPU
        cpu = psutil.cpu_percent(interval=0.1)
        
        # RAM
        ram_obj = psutil.virtual_memory()
        ram = {
            "percent": ram_obj.percent,
            "used": ram_obj.used,
            "free": ram_obj.available,
            "total": ram_obj.total
        }
        
        # Disk
        disk_obj = psutil.disk_usage('/')
        disk = {
            "percent": disk_obj.percent,
            "used": disk_obj.used,
            "free": disk_obj.free,
            "total": disk_obj.total
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
        return jsonify({"error": str(e)}), 500
