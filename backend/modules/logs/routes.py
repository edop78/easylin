"""System logs API — journalctl and log file viewer."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from utils.command import run_host_command

logs_bp = Blueprint("logs", __name__)


@logs_bp.route("/journal", methods=["GET"])
@jwt_required()
def journal_logs():
    """Get journalctl logs."""
    unit = request.args.get("unit", "")
    priority = request.args.get("priority", "")
    lines = min(int(request.args.get("lines", "100")), 500)
    since = request.args.get("since", "")

    cmd = f"journalctl --no-pager -n {lines}"
    if unit:
        cmd += f" -u {unit}"
    if priority:
        cmd += f" -p {priority}"
    if since:
        cmd += f' --since "{since}"'

    result = run_host_command(cmd, timeout=15)
    return jsonify({"logs": result["stdout"], "error": result["stderr"]})


@logs_bp.route("/units", methods=["GET"])
@jwt_required()
def list_units():
    """List available journal units."""
    result = run_host_command(
        "journalctl --field=_SYSTEMD_UNIT 2>/dev/null | head -50"
    )
    units = [u.strip() for u in result["stdout"].split("\n") if u.strip()]
    return jsonify({"units": units})


@logs_bp.route("/files", methods=["GET"])
@jwt_required()
def list_log_files():
    """List log files in /var/log."""
    result = run_host_command("find /var/log -type f -name '*.log' 2>/dev/null | head -50")
    files = [f.strip() for f in result["stdout"].split("\n") if f.strip()]
    return jsonify({"files": files})


@logs_bp.route("/file", methods=["GET"])
@jwt_required()
def read_log_file():
    """Read a log file."""
    path = request.args.get("path", "")
    lines = min(int(request.args.get("lines", "100")), 500)

    if not path or not path.startswith("/var/log"):
        return jsonify({"error": "Invalid log file path"}), 400

    result = run_host_command(f"tail -n {lines} {path}")
    return jsonify({"content": result["stdout"], "path": path})
