from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import logging
from utils.command import run_host_command
from .audit import run_security_audit_logic
from .helpers import (
    get_ssh_keys,
    add_ssh_key_logic,
    delete_ssh_key_logic,
    get_fail2ban_banned_ips,
    unban_fail2ban_ip_logic
)

security_bp = Blueprint("security", __name__)
logger = logging.getLogger(__name__)

@security_bp.route("/audit", methods=["GET"])
@jwt_required()
def run_security_audit():
    """Run security audit rules against host configuration."""
    result = run_security_audit_logic()
    return jsonify(result)

@security_bp.route("/fix", methods=["POST"])
@jwt_required()
def fix_security_issue():
    """Remediate a specific vulnerability."""
    data = request.get_json() or {}
    check_id = data.get("id")
    fix_cmd = data.get("fix_command")
    
    if not check_id or not fix_cmd:
        return jsonify({"success": False, "error": "Missing required parameters"}), 400
        
    allowed_fixes = {
        "ufw_status": "ufw enable",
        "ssh_port": "ufw allow 2222/tcp && sed -i 's/^#\\?Port.*/Port 2222/g' /etc/ssh/sshd_config && systemctl restart ssh",
        "ssh_root_login": "sed -i 's/^PermitRootLogin.*/PermitRootLogin prohibit-password/g' /etc/ssh/sshd_config && systemctl restart ssh",
        "ssh_password_auth": "sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/g' /etc/ssh/sshd_config && systemctl restart ssh",
        "docker_sock_perms": "chmod 660 /var/run/docker.sock",
        "system_updates": "apt-get update && apt-get upgrade -y",
        "passwordless_sudo": "sed -i 's/NOPASSWD://g' /etc/sudoers /etc/sudoers.d/*",
        "fail2ban_status": "systemctl start fail2ban" if "start" in fix_cmd else "apt-get install fail2ban -y && systemctl enable fail2ban && systemctl start fail2ban",
        "system_account_shells": "for u in bin sys sync games man lp mail news uucp proxy www-data backup list irc gnats nobody; do getent passwd $u && usermod -s /usr/sbin/nologin $u; done",
        "docker_exposed_ports": "ufw deny 3306/tcp && ufw deny 5432/tcp && ufw deny 27017/tcp && ufw deny 6379/tcp && ufw deny 9200/tcp",
        "root_ssh_keys": "chmod 600 /root/.ssh/authorized_keys"
    }
    
    expected_cmd = allowed_fixes.get(check_id)
    if not expected_cmd or (expected_cmd != fix_cmd and check_id != "fail2ban_status"):
        return jsonify({"success": False, "error": "Remediation action unauthorized or unsafe."}), 403
        
    if check_id == "fail2ban_status" and fix_cmd not in ["systemctl start fail2ban", "apt-get install fail2ban -y && systemctl enable fail2ban && systemctl start fail2ban"]:
         return jsonify({"success": False, "error": "Remediation action unauthorized or unsafe."}), 403

    res = run_host_command(fix_cmd)
    success = (res.get("returncode") == 0)
    
    return jsonify({
        "success": success,
        "stdout": res.get("stdout"),
        "stderr": res.get("stderr"),
        "message": "Remediation action executed successfully!" if success else f"Error during execution: {res.get('stderr')}"
    })

@security_bp.route("/ssh-keys", methods=["GET"])
@jwt_required()
def list_ssh_keys():
    """List all authorized SSH public keys on the host for the root user."""
    keys = get_ssh_keys()
    return jsonify({"keys": keys})

@security_bp.route("/ssh-keys", methods=["POST"])
@jwt_required()
def add_ssh_key():
    """Add a new authorized SSH key."""
    data = request.get_json() or {}
    key_string = data.get("key", "").strip()
    
    if not key_string:
        return jsonify({"error": "Key is required"}), 400
        
    success, msg = add_ssh_key_logic(key_string)
    if success:
        return jsonify({"success": True, "message": msg})
    else:
        return jsonify({"success": False, "error": msg}), 400

@security_bp.route("/ssh-keys/delete", methods=["POST"])
@jwt_required()
def delete_ssh_key():
    """Delete an authorized SSH key by matching its raw string."""
    data = request.get_json() or {}
    raw_key = data.get("raw", "").strip()
    
    if not raw_key:
        return jsonify({"error": "Raw key string matching is required"}), 400
        
    success, msg = delete_ssh_key_logic(raw_key)
    if success:
        return jsonify({"success": True, "message": msg})
    else:
        status_code = 404 if "not found" in msg.lower() else 500
        return jsonify({"success": False, "error": msg}), status_code

@security_bp.route("/fail2ban/banned", methods=["GET"])
@jwt_required()
def list_fail2ban_banned():
    """Get active Fail2ban status and banned IPs list."""
    res = get_fail2ban_banned_ips()
    return jsonify(res)

@security_bp.route("/fail2ban/unban", methods=["POST"])
@jwt_required()
def unban_fail2ban_ip():
    """Unban a specific IP in a Fail2ban jail."""
    data = request.get_json() or {}
    ip = data.get("ip", "").strip()
    jail = data.get("jail", "").strip()
    
    if not ip or not jail:
        return jsonify({"error": "IP and Jail name are required"}), 400
        
    success, msg = unban_fail2ban_ip_logic(ip, jail)
    if success:
        return jsonify({"success": True, "message": msg})
    else:
        return jsonify({"success": False, "error": msg}), 400
