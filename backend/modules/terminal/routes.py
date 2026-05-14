"""Terminal API — execute commands on the host."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from utils.command import run_host_command

terminal_bp = Blueprint("terminal", __name__)


@terminal_bp.route("/execute", methods=["POST"])
@jwt_required()
def execute_command():
    """Execute a command on the host and return the output."""
    data = request.get_json()
    command = data.get("command", "").strip()
    cwd = data.get("cwd", "/")
    timeout = min(data.get("timeout", 30), 120)  # Max 2 minutes

    if not command:
        return jsonify({"error": "Command is required"}), 400

    # Prepend cd to working directory
    full_command = f"cd {cwd} && {command}"

    result = run_host_command(full_command, timeout=timeout)

    return jsonify({
        "stdout": result["stdout"],
        "stderr": result["stderr"],
        "returncode": result["returncode"],
        "command": command,
        "cwd": cwd,
    })


@terminal_bp.route("/history", methods=["GET"])
@jwt_required()
def command_history():
    """Get shell history (placeholder for future implementation)."""
    return jsonify({"history": []})
