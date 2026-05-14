"""System management API — hostname, timezone, reboot, updates."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from utils.command import run_host_command

system_bp = Blueprint("system", __name__)


@system_bp.route("/maintenance", methods=["POST"])
@jwt_required()
def run_maintenance():
    """Run a maintenance command (apt, release-upgrade)."""
    data = request.get_json()
    cmd_type = data.get("command")
    
    commands = {
        "update": "apt-get update",
        "upgrade": "apt-get upgrade -y",
        "full-upgrade": "apt-get full-upgrade -y",
        "dist-upgrade": "apt-get dist-upgrade -y",
        "autoremove": "apt-get autoremove -y",
        "clean": "apt-get clean",
        "release-upgrade": "do-release-upgrade -f DistUpgradeViewNonInteractive",
        "release-upgrade-dev": "do-release-upgrade -d -f DistUpgradeViewNonInteractive"
    }
    
    cmd = commands.get(cmd_type)
    if not cmd:
        return jsonify({"error": "Invalid command"}), 400
        
    # Use longer timeout for upgrades
    res = run_host_command(cmd, timeout=600)
    
    return jsonify({
        "success": res["returncode"] == 0,
        "stdout": res["stdout"],
        "stderr": res["stderr"],
        "returncode": res["returncode"]
    })


@system_bp.route("/info", methods=["GET"])
@jwt_required()
def system_info():
    """Get system information."""
    hostname = run_host_command("hostname")
    timezone = run_host_command("timedatectl show --property=Timezone --value")
    kernel = run_host_command("uname -r")
    os_info = run_host_command("cat /etc/os-release")

    return jsonify({
        "hostname": hostname["stdout"],
        "timezone": timezone["stdout"],
        "kernel": kernel["stdout"],
        "os_release": os_info["stdout"],
    })


@system_bp.route("/hostname", methods=["PUT"])
@jwt_required()
def set_hostname():
    """Set the system hostname."""
    data = request.get_json()
    new_hostname = data.get("hostname", "").strip()
    if not new_hostname:
        return jsonify({"error": "Hostname is required"}), 400

    result = run_host_command(f"hostnamectl set-hostname {new_hostname}")
    if result["returncode"] != 0:
        return jsonify({"error": result["stderr"]}), 500

    return jsonify({"success": True, "hostname": new_hostname})


@system_bp.route("/timezone", methods=["PUT"])
@jwt_required()
def set_timezone():
    """Set the system timezone."""
    data = request.get_json()
    tz = data.get("timezone", "").strip()
    if not tz:
        return jsonify({"error": "Timezone is required"}), 400

    result = run_host_command(f"timedatectl set-timezone {tz}")
    if result["returncode"] != 0:
        return jsonify({"error": result["stderr"]}), 500

    return jsonify({"success": True, "timezone": tz})


@system_bp.route("/timezones", methods=["GET"])
@jwt_required()
def list_timezones():
    """List available timezones."""
    result = run_host_command("timedatectl list-timezones")
    timezones = result["stdout"].split("\n") if result["stdout"] else []
    return jsonify({"timezones": timezones})


@system_bp.route("/reboot", methods=["POST"])
@jwt_required()
def reboot():
    """Reboot the system."""
    run_host_command("reboot")
    return jsonify({"success": True, "message": "System is rebooting..."})


@system_bp.route("/shutdown", methods=["POST"])
@jwt_required()
def shutdown():
    """Shutdown the system."""
    run_host_command("shutdown -h now")
    return jsonify({"success": True, "message": "System is shutting down..."})


@system_bp.route("/updates/check", methods=["GET"])
@jwt_required()
def check_updates():
    """Check for available system updates."""
    run_host_command("apt-get update -qq", timeout=60)
    result = run_host_command("apt list --upgradable 2>/dev/null | tail -n +2")
    packages = []
    if result["stdout"]:
        for line in result["stdout"].split("\n"):
            if line.strip():
                packages.append(line.strip())
    return jsonify({"updates": packages, "count": len(packages)})


@system_bp.route("/updates/apply", methods=["POST"])
@jwt_required()
def apply_updates():
    """Apply all pending system updates."""
    result = run_host_command(
        "DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq",
        timeout=300,
    )
    return jsonify({
        "success": result["returncode"] == 0,
        "output": result["stdout"],
        "error": result["stderr"],
    })
