"""Users and groups management API."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from utils.command import run_host_command

users_bp = Blueprint("users", __name__)


@users_bp.route("/", methods=["GET"])
@jwt_required()
def list_users():
    """List system users (UID >= 1000 + root)."""
    result = run_host_command("awk -F: '$3>=1000||$3==0{print $1,$3,$4,$6,$7}' /etc/passwd")
    users = []
    if result["stdout"]:
        for line in result["stdout"].split("\n"):
            parts = line.strip().split()
            if len(parts) >= 5:
                users.append({
                    "username": parts[0],
                    "uid": int(parts[1]),
                    "gid": int(parts[2]),
                    "home": parts[3],
                    "shell": parts[4],
                })
    return jsonify({"users": users})


@users_bp.route("/groups", methods=["GET"])
@jwt_required()
def list_groups():
    """List system groups."""
    result = run_host_command("awk -F: '{print $1,$3,$4}' /etc/group")
    groups = []
    if result["stdout"]:
        for line in result["stdout"].split("\n"):
            parts = line.strip().split(None, 2)
            if len(parts) >= 2:
                groups.append({
                    "name": parts[0],
                    "gid": int(parts[1]),
                    "members": parts[2] if len(parts) > 2 else "",
                })
    return jsonify({"groups": groups})


@users_bp.route("/", methods=["POST"])
@jwt_required()
def create_user():
    """Create a new system user."""
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")
    shell = data.get("shell", "/bin/bash")
    create_home = data.get("create_home", True)

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    cmd = f"useradd"
    if create_home:
        cmd += " -m"
    cmd += f" -s {shell} {username}"

    result = run_host_command(cmd)
    if result["returncode"] != 0:
        return jsonify({"error": result["stderr"]}), 500

    # Set password
    pwd_result = run_host_command(f"echo '{username}:{password}' | chpasswd")
    if pwd_result["returncode"] != 0:
        return jsonify({"error": pwd_result["stderr"]}), 500

    return jsonify({"success": True, "username": username})


@users_bp.route("/<username>", methods=["DELETE"])
@jwt_required()
def delete_user(username):
    """Delete a system user."""
    if username in ("root",):
        return jsonify({"error": "Cannot delete root user"}), 403

    result = run_host_command(f"userdel -r {username}")
    if result["returncode"] != 0:
        return jsonify({"error": result["stderr"]}), 500

    return jsonify({"success": True})


@users_bp.route("/<username>/groups", methods=["PUT"])
@jwt_required()
def modify_user_groups(username):
    """Modify user group memberships."""
    data = request.get_json()
    groups = data.get("groups", "")

    result = run_host_command(f"usermod -aG {groups} {username}")
    if result["returncode"] != 0:
        return jsonify({"error": result["stderr"]}), 500

    return jsonify({"success": True})
