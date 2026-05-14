"""Systemd services management API."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from utils.command import run_host_command

services_bp = Blueprint("services", __name__)


@services_bp.route("/", methods=["GET"])
@jwt_required()
def list_services():
    """List systemd services."""
    result = run_host_command(
        "systemctl list-units --type=service --all --no-pager --no-legend "
        "--plain -o json 2>/dev/null || "
        "systemctl list-units --type=service --all --no-pager --no-legend --plain"
    )

    services = []
    if result["stdout"]:
        for line in result["stdout"].split("\n"):
            parts = line.strip().split(None, 4)
            if len(parts) >= 4:
                services.append({
                    "name": parts[0].replace(".service", ""),
                    "load": parts[1],
                    "active": parts[2],
                    "sub": parts[3],
                    "description": parts[4] if len(parts) > 4 else "",
                })

    return jsonify({"services": services})


@services_bp.route("/<name>/status", methods=["GET"])
@jwt_required()
def service_status(name):
    """Get detailed service status."""
    result = run_host_command(f"systemctl status {name}.service --no-pager -l")
    enabled = run_host_command(f"systemctl is-enabled {name}.service")

    return jsonify({
        "name": name,
        "output": result["stdout"],
        "enabled": enabled["stdout"].strip() == "enabled",
        "active": "active (running)" in result["stdout"],
    })


@services_bp.route("/<name>/<action>", methods=["POST"])
@jwt_required()
def service_action(name, action):
    """Start, stop, restart, enable, or disable a service."""
    allowed = ["start", "stop", "restart", "enable", "disable"]
    if action not in allowed:
        return jsonify({"error": f"Invalid action. Allowed: {allowed}"}), 400

    result = run_host_command(f"systemctl {action} {name}.service")
    return jsonify({
        "success": result["returncode"] == 0,
        "output": result["stdout"],
        "error": result["stderr"],
    })
