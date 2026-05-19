import re
import base64
from utils.command import run_host_command

def get_ssh_keys():
    # Ensure .ssh exists
    run_host_command("mkdir -p /root/.ssh && chmod 700 /root/.ssh && touch /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys")
    
    cat_res = run_host_command("cat /root/.ssh/authorized_keys")
    if cat_res.get("returncode") != 0:
        return []
        
    stdout = cat_res.get("stdout", "")
    lines = [l.strip() for l in stdout.split("\n") if l.strip()]
    
    keys = []
    for line in lines:
        if line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) >= 2:
            key_type = parts[0]
            key_val = parts[1]
            comment = parts[2] if len(parts) >= 3 else "N/A"
            # Preview key (first 12 and last 12 characters)
            preview = f"{key_val[:12]}...{key_val[-12:]}" if len(key_val) > 24 else key_val
            keys.append({
                "raw": line,
                "type": key_type,
                "preview": preview,
                "comment": comment
            })
    return keys

def add_ssh_key_logic(key_string):
    # Basic validation of SSH key
    if not any(key_string.startswith(prefix) for prefix in ["ssh-rsa", "ssh-dss", "ecdsa-sha2-", "ssh-ed25519"]):
        return False, "Invalid SSH Key format. Must start with ssh-rsa, ssh-ed25519, ecdsa, etc."
        
    encoded_key = base64.b64encode(key_string.encode('utf-8')).decode('utf-8')
    
    # Ensure authorized_keys exists and append the key safely
    append_cmd = (
        "mkdir -p /root/.ssh && chmod 700 /root/.ssh && "
        "touch /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys && "
        f"echo '{encoded_key}' | base64 -d >> /root/.ssh/authorized_keys"
    )
    
    res = run_host_command(append_cmd)
    if res.get("returncode") == 0:
        return True, "SSH Key added successfully"
    return False, res.get("stderr", "Unknown error")

def delete_ssh_key_logic(raw_key):
    # Read keys
    cat_res = run_host_command("cat /root/.ssh/authorized_keys")
    if cat_res.get("returncode") != 0:
        return False, "Could not read authorized keys file"
        
    stdout = cat_res.get("stdout", "")
    lines = [l.strip() for l in stdout.split("\n") if l.strip()]
    
    new_lines = [l for l in lines if l != raw_key]
    
    if len(lines) == len(new_lines):
        return False, "Key not found in authorized_keys"
        
    new_content = "\n".join(new_lines) + "\n" if new_lines else ""
    encoded_content = base64.b64encode(new_content.encode('utf-8')).decode('utf-8')
    
    write_cmd = f"echo '{encoded_content}' | base64 -d > /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys"
    res = run_host_command(write_cmd)
    
    if res.get("returncode") == 0:
        return True, "SSH Key deleted successfully"
    return False, res.get("stderr", "Unknown error")

def get_fail2ban_banned_ips():
    # Check if fail2ban service is active
    status_res = run_host_command("systemctl is-active fail2ban")
    is_active = (status_res.get("returncode") == 0 and status_res.get("stdout", "").strip() == "active")
    
    if not is_active:
        return {
            "active": False,
            "jails": [],
            "banned": []
        }
        
    jails_res = run_host_command("fail2ban-client status")
    if jails_res.get("returncode") != 0:
        return {
            "active": True,
            "jails": [],
            "banned": []
        }
        
    jails = []
    match = re.search(r"Jail list:\s*(.+)", jails_res.get("stdout", ""))
    if match:
        jails = [j.strip() for j in match.group(1).split(",")]
        
    banned_list = []
    for jail in jails:
        if not jail:
            continue
        jail_status = run_host_command(f"fail2ban-client status {jail}")
        if jail_status.get("returncode") == 0:
            ip_match = re.search(r"Banned IP list:\s*(.*)", jail_status.get("stdout", ""))
            if ip_match:
                ips = ip_match.group(1).split()
                for ip in ips:
                    banned_list.append({
                        "ip": ip,
                        "jail": jail
                    })
                    
    return {
        "active": True,
        "jails": jails,
        "banned": banned_list
    }

def unban_fail2ban_ip_logic(ip, jail):
    # Sanitize input
    jail = re.sub(r'[^a-zA-Z0-9\-_]', '', jail)
    # Basic IP validation
    if not re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', ip) and ":" not in ip:
        return False, "Invalid IP format"
        
    unban_cmd = f"fail2ban-client set {jail} unbanip {ip}"
    res = run_host_command(unban_cmd)
    
    if res.get("returncode") == 0:
        return True, f"IP {ip} unbanned from {jail} successfully"
    return False, res.get("stderr", "Unknown error")
