from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import os
import re
import json
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
        if "status: active" in stdout or ("active" in stdout and "inactive" not in stdout):
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
        cat_ssh = run_host_command("cat /etc/ssh/sshd_config")
        if cat_ssh.get("returncode") == 0:
            for line in cat_ssh.get("stdout", "").split("\n"):
                line = line.strip()
                if not line or line.startswith("#"): continue
                parts = line.split(None, 1)
                if len(parts) == 2:
                    key, val = parts[0].lower(), parts[1].strip().lower()
                    ssh_settings[key] = val

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
                "description": "SSH service is listening on the standard port (22). This exposes it to frequent brute-force attempts.",
                "fix_command": "ufw allow 2222/tcp && sed -i 's/^#\\?Port.*/Port 2222/g' /etc/ssh/sshd_config && systemctl restart ssh"
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
    stat_sock = run_host_command("stat -c '%a %U %G' /var/run/docker.sock")
    if stat_sock.get("returncode") == 0 and stat_sock.get("stdout"):
        perms = stat_sock["stdout"].strip().split()
        if len(perms) >= 3:
            mode = perms[0]
            owner = perms[1]
            group = perms[2]
            
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
        docker_list = run_host_command("curl -s --unix-socket /var/run/docker.sock http://localhost/containers/json")
        if docker_list.get("returncode") == 0 and docker_list.get("stdout"):
            containers = json.loads(docker_list["stdout"])
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
            "fix_command": "ufw deny 3306/tcp && ufw deny 5432/tcp && ufw deny 27017/tcp && ufw deny 6379/tcp && ufw deny 9200/tcp"
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

    # 6. Passwordless Sudo Configurations
    sudoers_res = run_host_command("grep -r -i -l \"nopasswd\" /etc/sudoers /etc/sudoers.d/ 2>/dev/null")
    if sudoers_res.get("returncode") == 0 and sudoers_res.get("stdout"):
        files = [os.path.basename(f.strip()) for f in sudoers_res["stdout"].split("\n") if f.strip()]
        checks.append({
            "id": "passwordless_sudo",
            "name": "Passwordless Sudo Configuration",
            "category": "Access",
            "status": "warning",
            "value": "NOPASSWD detected",
            "description": f"The following sudoer configuration file(s) allow passwordless command execution: {', '.join(files)}. This represents a potential privilege escalation vector if accounts are hijacked.",
            "fix_command": "sed -i 's/NOPASSWD://g' /etc/sudoers /etc/sudoers.d/*"
        })
    else:
        checks.append({
            "id": "passwordless_sudo",
            "name": "Passwordless Sudo Configuration",
            "category": "Access",
            "status": "secure",
            "value": "Disabled",
            "description": "No NOPASSWD parameters detected in active sudoers files. Users must input passwords to elevate privileges.",
            "fix_command": None
        })

    # 7. Fail2ban Brute-force Shield Status
    f2b_res = run_host_command("systemctl is-active fail2ban")
    if f2b_res.get("returncode") == 0 and f2b_res.get("stdout", "").strip() == "active":
        checks.append({
            "id": "fail2ban_status",
            "name": "Fail2ban Brute-Force Protection",
            "category": "Network",
            "status": "secure",
            "value": "Active",
            "description": "Fail2ban service is running and actively monitoring auth logs to block dictionary attacks.",
            "fix_command": None
        })
    else:
        f2b_check = run_host_command("which fail2ban-client")
        if f2b_check.get("returncode") == 0:
            checks.append({
                "id": "fail2ban_status",
                "name": "Fail2ban Brute-Force Protection",
                "category": "Network",
                "status": "risk",
                "value": "Inactive",
                "description": "Fail2ban is installed but the service is currently stopped or disabled.",
                "fix_command": "systemctl start fail2ban"
            })
        else:
            checks.append({
                "id": "fail2ban_status",
                "name": "Fail2ban Brute-Force Protection",
                "category": "Network",
                "status": "warning",
                "value": "Not Installed",
                "description": "Fail2ban is not installed. The server lacks automated log-scanning and IP-banning defenses against SSH brute force.",
                "fix_command": "apt-get install fail2ban -y && systemctl enable fail2ban && systemctl start fail2ban"
            })

    # 8. Insecure Shells on Default System Accounts
    system_users = ["bin", "sys", "sync", "games", "man", "lp", "mail", "news", "uucp", "proxy", "www-data", "backup", "list", "irc", "gnats", "nobody"]
    insecure_shells = []
    passwd_res = run_host_command("cat /etc/passwd")
    if passwd_res.get("returncode") == 0 and passwd_res.get("stdout"):
        for line in passwd_res["stdout"].split("\n"):
            parts = line.strip().split(":")
            if len(parts) >= 7:
                user = parts[0]
                shell = parts[6]
                if user in system_users and shell not in ["/usr/sbin/nologin", "/bin/false", "/sbin/nologin"]:
                    insecure_shells.append(f"{user} ({shell})")
            
    if insecure_shells:
        checks.append({
            "id": "system_account_shells",
            "name": "Service Account Login Shells",
            "category": "Access",
            "status": "warning",
            "value": f"{len(insecure_shells)} active",
            "description": f"The following system service accounts have interactive login shells: {', '.join(insecure_shells)}. They should be disabled to prevent local shell execution hijacking.",
            "fix_command": "for u in bin sys sync games man lp mail news uucp proxy www-data backup list irc gnats nobody; do getent passwd $u && usermod -s /usr/sbin/nologin $u; done"
        })
    else:
        checks.append({
            "id": "system_account_shells",
            "name": "Service Account Login Shells",
            "category": "Access",
            "status": "secure",
            "value": "All Disabled (Secure)",
            "description": "All default non-privileged system service accounts have login shells correctly disabled or restricted.",
            "fix_command": None
        })

    # 9. Docker Daemon TCP API Port Exposure
    docker_tcp = run_host_command("ss -tlnp | grep -E \"237[56]\"")
    if docker_tcp.get("returncode") == 0 and docker_tcp.get("stdout"):
        stdout = docker_tcp.get("stdout")
        if "2375" in stdout:
            checks.append({
                "id": "docker_tcp_exposure",
                "name": "Docker TCP Socket API",
                "category": "Docker",
                "status": "risk",
                "value": "Exposed Unencrypted (2375)",
                "description": "Docker Daemon API is listening publicly on unencrypted TCP port 2375. This allows unauthenticated remote users to gain complete root command execution.",
                "fix_command": None
            })
        else:
            checks.append({
                "id": "docker_tcp_exposure",
                "name": "Docker TCP Socket API",
                "category": "Docker",
                "status": "warning",
                "value": "Exposed with TLS (2376)",
                "description": "Docker Daemon API is listening on port 2376 with TLS. Ensure client certificates are kept secure.",
                "fix_command": None
            })
    else:
        checks.append({
            "id": "docker_tcp_exposure",
            "name": "Docker TCP Socket API",
            "category": "Docker",
            "status": "secure",
            "value": "Not Exposed via TCP",
            "description": "Docker Daemon API is restricted to the local Unix socket, which is the secure default configuration.",
            "fix_command": None
        })

    # 10. Root SSH key file permissions
    stat_keys = run_host_command("stat -c '%a' /root/.ssh/authorized_keys")
    if stat_keys.get("returncode") == 0 and stat_keys.get("stdout"):
        mode = stat_keys["stdout"].strip()
        if len(mode) == 3 and (mode[1] != '0' or mode[2] != '0'):
            checks.append({
                "id": "root_ssh_keys",
                "name": "Root SSH Key Permissions",
                "category": "Access",
                "status": "risk",
                "value": f"Insecure ({mode})",
                "description": f"The root authorized_keys file has unsafe read/write permissions ({mode}). Other local users could view or append unauthorized access keys.",
                "fix_command": "chmod 600 /root/.ssh/authorized_keys"
            })
        else:
            checks.append({
                "id": "root_ssh_keys",
                "name": "Root SSH Key Permissions",
                "category": "Access",
                "status": "secure",
                "value": f"Secure ({mode})",
                "description": "The root authorized_keys file has secure, restricted permissions (600), allowing only the root owner to read/write it.",
                "fix_command": None
            })
    else:
        check_file = run_host_command("test -f /root/.ssh/authorized_keys")
        if check_file.get("returncode") == 0:
            checks.append({
                "id": "root_ssh_keys",
                "name": "Root SSH Key Permissions",
                "category": "Access",
                "status": "warning",
                "value": "Unverifiable",
                "description": "Unable to verify file access permissions for root's SSH authorized keys.",
                "fix_command": None
            })
        else:
            checks.append({
                "id": "root_ssh_keys",
                "name": "Root SSH Key Permissions",
                "category": "Access",
                "status": "secure",
                "value": "No root keys file",
                "description": "No SSH authorized keys file exists for the root user. Standard credential controls apply.",
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
