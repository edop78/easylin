from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import os
import re
import json
import subprocess
try:
    from backend.config import Config
except ImportError:
    from config import Config

security_bp = Blueprint("security", __name__)

def get_run_command():
    try:
        from backend.utils.command import run_host_command
        return run_host_command
    except ImportError:
        try:
            from utils.command import run_host_command
            return run_host_command
        except ImportError:
            return lambda cmd, **kwargs: {"stdout": "", "stderr": "Command utility not found", "returncode": 1}

run_host_command = get_run_command()

@security_bp.route("/audit", methods=["GET"])
@jwt_required()
def run_security_audit():
    checks = []
    
    # 1. Firewall (UFW) Status
    ufw_res = run_host_command("ufw status")
    if ufw_res.get("returncode") == 0:
        stdout = ufw_res.get("stdout", "").lower()
        if "status: active" in stdout or "active" in stdout:
            checks.append({
                "id": "ufw_status",
                "name": "Firewall Status (UFW)",
                "category": "Network",
                "status": "secure",
                "value": "Active",
                "description": "UFW firewall is active and protecting unauthorized system ports.",
                "fix_command": None
            })
        else:
            checks.append({
                "id": "ufw_status",
                "name": "Firewall Status (UFW)",
                "category": "Network",
                "status": "risk",
                "value": "Disabled",
                "description": "UFW firewall is installed but disabled. This exposes the server to unauthorized incoming traffic.",
                "fix_command": "ufw enable"
            })
    else:
        # Check if ufw is installed
        check_ufw = run_host_command("which ufw")
        if check_ufw.get("returncode") == 0:
            checks.append({
                "id": "ufw_status",
                "name": "Firewall Status (UFW)",
                "category": "Network",
                "status": "risk",
                "value": "Inactive / Not Configured",
                "description": "The firewall is not active or not responding correctly.",
                "fix_command": "ufw enable"
            })
        else:
            checks.append({
                "id": "ufw_status",
                "name": "Firewall Status (UFW)",
                "category": "Network",
                "status": "warning",
                "value": "UFW Not Installed",
                "description": "UFW is not installed on the system. It is highly recommended to install a firewall to restrict access.",
                "fix_command": "apt-get install ufw -y && ufw allow 5050/tcp && ufw enable"
            })

    # 2. SSH Configuration Checks
    ssh_settings = {}
    sshd_res = run_host_command("sshd -T")
    if sshd_res.get("returncode") == 0:
        stdout = sshd_res.get("stdout", "")
        for line in stdout.split("\n"):
            line = line.strip()
            if not line: continue
            parts = line.split(" ", 1)
            if len(parts) == 2:
                key, val = parts[0].lower(), parts[1].strip().lower()
                ssh_settings[key] = val
    else:
        # Fallback to reading file directly
        sshd_config_path = "/host/etc/ssh/sshd_config"
        if os.path.exists(sshd_config_path):
            try:
                with open(sshd_config_path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"): continue
                        parts = line.split(None, 1)
                        if len(parts) == 2:
                            key, val = parts[0].lower(), parts[1].strip().lower()
                            ssh_settings[key] = val
            except:
                pass

    if ssh_settings:
        # SSH Port Check
        port = ssh_settings.get("port", "22")
        if port == "22":
            checks.append({
                "id": "ssh_port",
                "name": "SSH Port Configuration",
                "category": "Access",
                "status": "warning",
                "value": f"Port {port} (Default)",
                "description": "SSH service is listening on the standard port (22). This exposes it to frequent automated brute-force attempts.",
                "fix_command": "echo 'Custom port recommended in /etc/ssh/sshd_config'"
            })
        else:
            checks.append({
                "id": "ssh_port",
                "name": "SSH Port Configuration",
                "category": "Access",
                "status": "secure",
                "value": f"Port {port} (Custom)",
                "description": f"SSH service is listening on a non-standard port ({port}), which significantly reduces automated scanning noise.",
                "fix_command": None
            })

        # Permit Root Login Check
        permit_root = ssh_settings.get("permitrootlogin", "yes")
        if permit_root in ["yes", "prohibit-password", "without-password"]:
            if permit_root == "yes":
                checks.append({
                    "id": "ssh_root_login",
                    "name": "SSH Root Login Access",
                    "category": "Access",
                    "status": "risk",
                    "value": "Enabled",
                    "description": "Direct SSH login as root with a password is allowed. This is a critical security risk.",
                    "fix_command": "sed -i 's/^PermitRootLogin.*/PermitRootLogin prohibit-password/g' /etc/ssh/sshd_config && systemctl restart ssh"
                })
            else:
                checks.append({
                    "id": "ssh_root_login",
                    "name": "SSH Root Login Access",
                    "category": "Access",
                    "status": "secure",
                    "value": "Keys Only (Secure)",
                    "description": f"SSH root login is set to '{permit_root}' (only public key authentication is allowed).",
                    "fix_command": None
                })
        else:
            checks.append({
                "id": "ssh_root_login",
                "name": "SSH Root Login Access",
                "category": "Access",
                "status": "secure",
                "value": "Disabled",
                "description": "Direct root SSH access is disabled (most secure configuration).",
                "fix_command": None
            })

        # Password Authentication Check
        pwd_auth = ssh_settings.get("passwordauthentication", "yes")
        if pwd_auth == "yes":
            checks.append({
                "id": "ssh_password_auth",
                "name": "SSH Password Authentication",
                "category": "Access",
                "status": "warning",
                "value": "Enabled",
                "description": "SSH password login is enabled. It is recommended to use public keys and disable password auth.",
                "fix_command": "sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/g' /etc/ssh/sshd_config && systemctl restart ssh"
            })
        else:
            checks.append({
                "id": "ssh_password_auth",
                "name": "SSH Password Authentication",
                "category": "Access",
                "status": "secure",
                "value": "Disabled (Keys only)",
                "description": "SSH password authentication is disabled. Authentication is limited to public keys.",
                "fix_command": None
            })
    else:
        checks.append({
            "id": "ssh_config",
            "name": "SSH Service Configuration",
            "category": "Access",
            "status": "warning",
            "value": "Undetectable",
            "description": "Could not parse or read the SSH daemon configurations on the host system.",
            "fix_command": None
        })

    # 3. Docker Socket Permissions Check
    docker_sock = "/host/var/run/docker.sock"
    if not os.path.exists(docker_sock):
        docker_sock = "/var/run/docker.sock"
        
    if os.path.exists(docker_sock):
        try:
            stat_res = subprocess.run(["stat", "-c", "%a %U %G", docker_sock], capture_output=True, text=True)
            if stat_res.returncode == 0:
                perms = stat_res.stdout.strip().split()
                mode = perms[0]
                owner = perms[1]
                group = perms[2]
                
                # Check world-writable
                if mode[-1] in ["2", "3", "6", "7"]:
                    checks.append({
                        "id": "docker_sock_perms",
                        "name": "Docker Socket Permissions",
                        "category": "Docker",
                        "status": "risk",
                        "value": f"Insecure ({mode})",
                        "description": "The Docker socket has public write permissions. Any non-privileged local user can gain root access on the host.",
                        "fix_command": "chmod 660 /var/run/docker.sock"
                    })
                else:
                    checks.append({
                        "id": "docker_sock_perms",
                        "name": "Docker Socket Permissions",
                        "category": "Docker",
                        "status": "secure",
                        "value": f"Secure ({mode} - {group})",
                        "description": "Docker socket permissions are restricted to authorized users (owner or docker group).",
                        "fix_command": None
                    })
            else:
                checks.append({
                    "id": "docker_sock_perms",
                    "name": "Docker Socket Permissions",
                    "category": "Docker",
                    "status": "warning",
                    "value": "Unverifiable",
                    "description": "Unable to determine the file permissions of the Docker socket.",
                    "fix_command": None
                })
        except:
            pass
    else:
        checks.append({
            "id": "docker_sock_perms",
            "name": "Docker Socket Permissions",
            "category": "Docker",
            "status": "warning",
            "value": "Socket not found",
            "description": "The Docker socket file was not found in the default path (/var/run/docker.sock).",
            "fix_command": None
        })

    # 4. Outdated Packages & Security updates
    updates_file = "/host/var/lib/update-notifier/updates-available"
    sec_updates = 0
    tot_updates = 0
    found_updates = False
    
    if os.path.exists(updates_file):
        try:
            with open(updates_file, "r") as f:
                content = f.read()
                # Parse e.g. "X updates can be applied" and "Y updates are security updates."
                m_sec = re.search(r"(\d+)\s+updates?\s+are\s+security\s+updates", content, re.IGNORECASE)
                m_tot = re.search(r"(\d+)\s+updates?\s+can\s+be\s+applied", content, re.IGNORECASE)
                if m_sec:
                    sec_updates = int(m_sec.group(1))
                    found_updates = True
                if m_tot:
                    tot_updates = int(m_tot.group(1))
                    found_updates = True
        except:
            pass

    if not found_updates:
        # Fallback: run a dry-run check of updates
        apt_res = run_host_command("apt-get -s upgrade")
        if apt_res.get("returncode") == 0:
            stdout = apt_res.get("stdout", "")
            # Count lines starting with Inst or check for security keywords
            inst_lines = [l for l in stdout.split("\n") if l.startswith("Inst ")]
            tot_updates = len(inst_lines)
            sec_lines = [l for l in inst_lines if "security" in l.lower() or "vuln" in l.lower() or "patch" in l.lower()]
            sec_updates = len(sec_lines)
            found_updates = True
            
    if found_updates:
        if sec_updates > 0:
            checks.append({
                "id": "system_updates",
                "name": "Pending Security Updates",
                "category": "System",
                "status": "risk",
                "value": f"{sec_updates} critical ({tot_updates} total)",
                "description": f"There are {sec_updates} pending security updates on the host system. The OS is vulnerable to known exploits.",
                "fix_command": "apt-get update && apt-get upgrade -y"
            })
        elif tot_updates > 0:
            checks.append({
                "id": "system_updates",
                "name": "Pending Security Updates",
                "category": "System",
                "status": "warning",
                "value": f"{tot_updates} updates available",
                "description": "No critical security updates pending, but some general software updates are available.",
                "fix_command": "apt-get update && apt-get upgrade -y"
            })
        else:
            checks.append({
                "id": "system_updates",
                "name": "Pending Security Updates",
                "category": "System",
                "status": "secure",
                "value": "System Up to Date",
                "description": "No pending updates for the host operating system.",
                "fix_command": None
            })
    else:
        checks.append({
            "id": "system_updates",
            "name": "Pending Security Updates",
            "category": "System",
            "status": "warning",
            "value": "Unverifiable",
            "description": "Could not retrieve APT updates status from the host operating system.",
            "fix_command": None
        })

    # 5. Public Sensitive Ports Exposure (Docker Containers)
    sensitive_ports = [3306, 5432, 27017, 6379, 2375, 2376, 9200, 9300]
    exposed_containers = []
    
    try:
        # Check container list from Docker socket
        docker_list = subprocess.run(['curl', '-s', '--unix-socket', docker_sock, 'http://localhost/containers/json'], capture_output=True, text=True, timeout=5)
        if docker_list.returncode == 0:
            containers = json.loads(docker_list.stdout)
            for c in containers:
                c_name = ", ".join(c.get('Names', [])).replace("/", "")
                ports = c.get('Ports', [])
                for p in ports:
                    public_port = p.get('PublicPort')
                    ip = p.get('IP')
                    if public_port and ip in ['0.0.0.0', '::']:
                        if public_port in sensitive_ports:
                            exposed_containers.append(f"{c_name} (Port {public_port})")
    except Exception as e:
        print(f"Docker API parse warning: {e}")
        
    if exposed_containers:
        checks.append({
            "id": "docker_exposed_ports",
            "name": "Exposed Sensitive Ports",
            "category": "Docker",
            "status": "warning",
            "value": f"{len(exposed_containers)} exposed",
            "description": f"The following sensitive services in Docker containers are exposed to the public internet (0.0.0.0): {', '.join(exposed_containers)}.",
            "fix_command": "Configure port bindings in docker-compose.yml to 127.0.0.1 instead of 0.0.0.0"
        })
    else:
        checks.append({
            "id": "docker_exposed_ports",
            "name": "Exposed Sensitive Ports",
            "category": "Docker",
            "status": "secure",
            "value": "No exposed ports",
            "description": "No database or critical ports inside Docker containers are exposed publicly.",
            "fix_command": None
        })

    # Calculate global security status
    risks_count = sum(1 for c in checks if c["status"] == "risk")
    warnings_count = sum(1 for c in checks if c["status"] == "warning")
    
    if risks_count > 0:
        global_status = "risk"
        global_message = "The server has critical vulnerabilities that require immediate attention!"
    elif warnings_count > 0:
        global_status = "warning"
        global_message = "The server is partially secure, but has some warnings."
    else:
        global_status = "secure"
        global_message = "The server is configured according to key security recommendations!"
        
    return jsonify({
        "checks": checks,
        "global_status": global_status,
        "global_message": global_message,
        "risks": risks_count,
        "warnings": warnings_count,
        "secure_count": len(checks) - risks_count - warnings_count
    })

@security_bp.route("/fix", methods=["POST"])
@jwt_required()
def fix_security_issue():
    data = request.get_json() or {}
    check_id = data.get("id")
    fix_cmd = data.get("fix_command")
    
    if not check_id or not fix_cmd:
        return jsonify({"success": False, "error": "Missing required parameters"}), 400
        
    # Security restriction: do not run arbitrary commands, check against allowlist
    allowed_fixes = {
        "ufw_status": "ufw enable",
        "ssh_root_login": "sed -i 's/^PermitRootLogin.*/PermitRootLogin prohibit-password/g' /etc/ssh/sshd_config && systemctl restart ssh",
        "ssh_password_auth": "sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/g' /etc/ssh/sshd_config && systemctl restart ssh",
        "docker_sock_perms": "chmod 660 /var/run/docker.sock",
        "system_updates": "apt-get update && apt-get upgrade -y"
    }
    
    # We allow the specific command associated with this check
    expected_cmd = allowed_fixes.get(check_id)
    if not expected_cmd or expected_cmd != fix_cmd:
        return jsonify({"success": False, "error": "Remediation action unauthorized or unsafe."}), 403
        
    # Execute the fix
    res = run_host_command(fix_cmd)
    success = (res.get("returncode") == 0)
    
    return jsonify({
        "success": success,
        "stdout": res.get("stdout"),
        "stderr": res.get("stderr"),
        "message": "Remediation action executed successfully!" if success else f"Error during execution: {res.get('stderr')}"
    })
