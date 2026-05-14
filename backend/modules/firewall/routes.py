"""Firewall (UFW) management API."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from utils.command import run_host_command

firewall_bp = Blueprint("firewall", __name__)


@firewall_bp.route("/status", methods=["GET"])
@jwt_required()
def ufw_status():
    """Get UFW status and rules."""
    result = run_host_command("ufw status numbered")
    status = run_host_command("ufw status | head -1")

    is_active = "active" in status.get("stdout", "").lower() and "inactive" not in status.get("stdout", "").lower()

    rules = []
    if result["stdout"]:
        for line in result["stdout"].split("\n"):
            line = line.strip()
            if line.startswith("["):
                rules.append(line)

    return jsonify({
        "active": is_active,
        "rules": rules,
        "raw": result["stdout"],
    })


@firewall_bp.route("/enable", methods=["POST"])
@jwt_required()
def enable_ufw():
    """Enable UFW."""
    result = run_host_command("echo 'y' | ufw enable")
    return jsonify({
        "success": result["returncode"] == 0,
        "output": result["stdout"],
    })


@firewall_bp.route("/disable", methods=["POST"])
@jwt_required()
def disable_ufw():
    """Disable UFW."""
    result = run_host_command("ufw disable")
    return jsonify({
        "success": result["returncode"] == 0,
        "output": result["stdout"],
    })


@firewall_bp.route("/rules", methods=["POST"])
@jwt_required()
def add_rule():
    """Add a UFW rule."""
    data = request.get_json()
    action = data.get("action", "allow")  # allow or deny
    port = data.get("port", "")
    protocol = data.get("protocol", "")  # tcp, udp, or empty
    from_ip = data.get("from", "")

    if not port:
        return jsonify({"error": "Port is required"}), 400

    if action not in ("allow", "deny"):
        return jsonify({"error": "Action must be 'allow' or 'deny'"}), 400

    cmd = f"ufw {action}"
    if from_ip:
        cmd += f" from {from_ip}"
    cmd += f" to any port {port}"
    if protocol:
        cmd += f" proto {protocol}"

    result = run_host_command(cmd)
    return jsonify({
        "success": result["returncode"] == 0,
        "output": result["stdout"],
        "error": result["stderr"],
    })


@firewall_bp.route("/rules/<int:rule_number>", methods=["DELETE"])
@jwt_required()
def delete_rule(rule_number):
    """Delete a UFW rule by number."""
    result = run_host_command(f"echo 'y' | ufw delete {rule_number}")
    return jsonify({
        "success": result["returncode"] == 0,
        "output": result["stdout"],
    })
