"""Package management API — install, remove, search packages."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from utils.command import run_host_command

packages_bp = Blueprint("packages", __name__)


@packages_bp.route("/installed", methods=["GET"])
@jwt_required()
def list_installed():
    """List installed packages."""
    search = request.args.get("search", "")
    if search:
        result = run_host_command(
            f"dpkg -l | grep -i '{search}' | awk '{{print $2, $3, $4}}'",
            timeout=15,
        )
    else:
        result = run_host_command(
            "dpkg -l | tail -n +6 | awk '{print $2, $3, $4}' | head -200",
            timeout=15,
        )

    packages = []
    if result["stdout"]:
        for line in result["stdout"].split("\n"):
            parts = line.strip().split(None, 2)
            if len(parts) >= 2:
                packages.append({
                    "name": parts[0],
                    "version": parts[1],
                    "description": parts[2] if len(parts) > 2 else "",
                })

    return jsonify({"packages": packages, "count": len(packages)})


@packages_bp.route("/search", methods=["GET"])
@jwt_required()
def search_packages():
    """Search available packages."""
    query = request.args.get("q", "").strip()
    if not query or len(query) < 2:
        return jsonify({"error": "Search query must be at least 2 characters"}), 400

    result = run_host_command(
        f"apt-cache search '{query}' | head -50",
        timeout=15,
    )

    packages = []
    if result["stdout"]:
        for line in result["stdout"].split("\n"):
            parts = line.strip().split(" - ", 1)
            if len(parts) == 2:
                packages.append({
                    "name": parts[0].strip(),
                    "description": parts[1].strip(),
                })

    return jsonify({"packages": packages})


@packages_bp.route("/install", methods=["POST"])
@jwt_required()
def install_package():
    """Install a package."""
    data = request.get_json()
    package_name = data.get("name", "").strip()
    if not package_name:
        return jsonify({"error": "Package name is required"}), 400

    # Sanitize — only allow alphanumeric, dash, dot, plus
    if not all(c.isalnum() or c in "-._+" for c in package_name):
        return jsonify({"error": "Invalid package name"}), 400

    result = run_host_command(
        f"DEBIAN_FRONTEND=noninteractive apt-get install -y -qq {package_name}",
        timeout=120,
    )

    return jsonify({
        "success": result["returncode"] == 0,
        "output": result["stdout"],
        "error": result["stderr"],
    })


@packages_bp.route("/remove", methods=["POST"])
@jwt_required()
def remove_package():
    """Remove a package."""
    data = request.get_json()
    package_name = data.get("name", "").strip()
    if not package_name:
        return jsonify({"error": "Package name is required"}), 400

    # Safety: prevent removing critical packages
    critical = ["systemd", "bash", "coreutils", "dpkg", "apt", "libc6", "linux-image"]
    if package_name in critical:
        return jsonify({"error": "Cannot remove critical system package"}), 403

    result = run_host_command(
        f"DEBIAN_FRONTEND=noninteractive apt-get remove -y -qq {package_name}",
        timeout=60,
    )

    return jsonify({
        "success": result["returncode"] == 0,
        "output": result["stdout"],
        "error": result["stderr"],
    })
