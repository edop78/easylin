from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import sys
import os
import re

services_bp = Blueprint("services", __name__)

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

@services_bp.route("", methods=["GET"])
@services_bp.route("/", methods=["GET"])
@jwt_required()
def list_services():
    """List all systemd services with clean parsing."""
    # --plain removes symbols/colors from output
    res = run_host_command("systemctl list-units --type=service --all --no-pager --no-legend --plain")
    
    if res.get("returncode") != 0:
        return jsonify({"error": res.get("stderr", "Failed to list services")}), 500
        
    services = []
    lines = res.get("stdout", "").strip().split("\n")
    
    for line in lines:
        line = line.strip()
        if not line: continue
        
        # Remove status symbols (●, *, etc.)
        line = re.sub(r'^[●\*\.\s\?]+', '', line)
            
        # systemctl list-units output: UNIT LOAD ACTIVE SUB [DESCRIPTION]
        parts = line.split(None, 4)
        if len(parts) >= 4:
            name = parts[0].replace(".service", "")
            if not name: continue
                
            services.append({
                "name": name,
                "load": parts[1],
                "active": parts[2],
                "sub": parts[3],
                "description": parts[4] if len(parts) > 4 else ""
            })
            
    # Sort services by name
    services.sort(key=lambda x: x["name"])
    return jsonify({"services": services})

@services_bp.route("/<name>/<action>", methods=["POST"])
@jwt_required()
def service_action(name, action):
    allowed_actions = ["start", "stop", "restart", "enable", "disable"]
    if action not in allowed_actions:
        return jsonify({"error": "Invalid action"}), 400
        
    res = run_host_command(f"systemctl {action} {name}.service")
    if res.get("returncode") == 0:
        return jsonify({"success": True, "message": f"Service {name} {action}ed successfully"})
    else:
        return jsonify({"success": False, "error": res.get("stderr", "Action failed")}), 500

@services_bp.route("/<name>/logs", methods=["GET"])
@jwt_required()
def service_logs(name):
    res = run_host_command(f"journalctl -u {name}.service -n 100 --no-pager")
    if res.get("returncode") == 0:
        return jsonify({"logs": res.get("stdout", "")})
    else:
        return jsonify({"error": res.get("stderr", "Failed to get logs")}), 500
