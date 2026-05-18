"""File manager API — browse, read, and edit files."""

import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from utils.command import run_host_command
from config import Config

files_bp = Blueprint("files", __name__)


def host_path(path):
    """Convert a logical path to the host-mounted path."""
    if Config.IN_DOCKER:
        return os.path.join(Config.HOST_ROOT, path.lstrip("/"))
    return path


@files_bp.route("/browse", methods=["GET"])
@jwt_required()
def browse():
    """List directory contents."""
    path = request.args.get("path", "/")
    real_path = host_path(path)

    try:
        entries = []
        for entry in os.scandir(real_path):
            try:
                stat = entry.stat(follow_symlinks=False)
                entries.append({
                    "name": entry.name,
                    "path": os.path.join(path, entry.name),
                    "is_dir": entry.is_dir(follow_symlinks=False),
                    "is_link": entry.is_symlink(),
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "permissions": oct(stat.st_mode)[-3:],
                })
            except (PermissionError, OSError):
                entries.append({
                    "name": entry.name,
                    "path": os.path.join(path, entry.name),
                    "is_dir": False,
                    "is_link": False,
                    "size": 0,
                    "modified": 0,
                    "permissions": "---",
                    "error": "Permission denied",
                })

        # Sort: directories first, then by name
        entries.sort(key=lambda e: (not e["is_dir"], e["name"].lower()))
        return jsonify({"path": path, "entries": entries})

    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403
    except FileNotFoundError:
        return jsonify({"error": "Path not found"}), 404


@files_bp.route("/read", methods=["GET"])
@jwt_required()
def read_file():
    """Read a file's contents."""
    path = request.args.get("path", "")
    if not path:
        return jsonify({"error": "Path is required"}), 400

    real_path = host_path(path)

    try:
        # Check file size (limit to 1MB)
        size = os.path.getsize(real_path)
        if size > 1_048_576:
            return jsonify({"error": "File too large (max 1MB)"}), 400

        with open(real_path, "r", errors="replace") as f:
            content = f.read()

        return jsonify({"path": path, "content": content, "size": size})

    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404
    except UnicodeDecodeError:
        return jsonify({"error": "Binary file cannot be displayed"}), 400


@files_bp.route("/write", methods=["PUT"])
@jwt_required()
def write_file():
    """Write content to a file."""
    data = request.get_json()
    path = data.get("path", "").strip()
    content = data.get("content", "")

    if not path:
        return jsonify({"error": "Path is required"}), 400

    real_path = host_path(path)

    try:
        # Write natively inside Python (100% secure, no shell injection)
        with open(real_path, "w", encoding="utf-8") as f:
            f.write(content)
        return jsonify({
            "success": True,
            "error": ""
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
