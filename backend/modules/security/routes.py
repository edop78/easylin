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
        if "status: active" in stdout or "attivo" in stdout:
            checks.append({
                "id": "ufw_status",
                "name": "Stato del Firewall (UFW)",
                "category": "Network",
                "status": "secure",
                "value": "Attivo",
                "description": "Il firewall UFW è attivo e protegge le porte di sistema non autorizzate.",
                "fix_command": None
            })
        else:
            checks.append({
                "id": "ufw_status",
                "name": "Stato del Firewall (UFW)",
                "category": "Network",
                "status": "risk",
                "value": "Disattivato",
                "description": "Il firewall UFW è installato ma disattivato. Questo espone il server a connessioni esterne indesiderate.",
                "fix_command": "ufw enable"
            })
    else:
        # Check if ufw is installed
        check_ufw = run_host_command("which ufw")
        if check_ufw.get("returncode") == 0:
            checks.append({
                "id": "ufw_status",
                "name": "Stato del Firewall (UFW)",
                "category": "Network",
                "status": "risk",
                "value": "Non configurato o Inattivo",
                "description": "Il firewall non è attivo o non risponde correttamente.",
                "fix_command": "ufw enable"
            })
        else:
            checks.append({
                "id": "ufw_status",
                "name": "Stato del Firewall (UFW)",
                "category": "Network",
                "status": "warning",
                "value": "UFW Non Installato",
                "description": "UFW non è installato sul sistema. Si consiglia di installare un firewall per limitare gli accessi.",
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
                "name": "Porta di Ascolto SSH",
                "category": "Access",
                "status": "warning",
                "value": f"Porta {port} (Default)",
                "description": "Il servizio SSH è in ascolto sulla porta standard (22). Questo espone a frequenti tentativi automatizzati di brute-force.",
                "fix_command": "echo 'Porta personalizzata consigliata in /etc/ssh/sshd_config'"
            })
        else:
            checks.append({
                "id": "ssh_port",
                "name": "Porta di Ascolto SSH",
                "category": "Access",
                "status": "secure",
                "value": f"Porta {port} (Personalizzata)",
                "description": f"Il servizio SSH utilizza una porta non standard ({port}), riducendo il rumore dei tentativi brute-force automatici.",
                "fix_command": None
            })

        # Permit Root Login Check
        permit_root = ssh_settings.get("permitrootlogin", "yes")
        if permit_root in ["yes", "prohibit-password", "without-password"]:
            if permit_root == "yes":
                checks.append({
                    "id": "ssh_root_login",
                    "name": "Accesso Root SSH",
                    "category": "Access",
                    "status": "risk",
                    "value": "Abilitato",
                    "description": "L'accesso SSH per l'utente root è abilitato con password. Rappresenta una vulnerabilità critica.",
                    "fix_command": "sed -i 's/^PermitRootLogin.*/PermitRootLogin prohibit-password/g' /etc/ssh/sshd_config && systemctl restart ssh"
                })
            else:
                checks.append({
                    "id": "ssh_root_login",
                    "name": "Accesso Root SSH",
                    "category": "Access",
                    "status": "secure",
                    "value": "Solo Chiavi (Sicuro)",
                    "description": f"L'accesso root SSH è configurato come '{permit_root}' (solo chiavi crittografiche pubbliche).",
                    "fix_command": None
                })
        else:
            checks.append({
                "id": "ssh_root_login",
                "name": "Accesso Root SSH",
                "category": "Access",
                "status": "secure",
                "value": "Disabilitato",
                "description": "L'accesso SSH diretto per l'utente root è disabilitato (opzione più sicura).",
                "fix_command": None
            })

        # Password Authentication Check
        pwd_auth = ssh_settings.get("passwordauthentication", "yes")
        if pwd_auth == "yes":
            checks.append({
                "id": "ssh_password_auth",
                "name": "Autenticazione SSH con Password",
                "category": "Access",
                "status": "warning",
                "value": "Abilitata",
                "description": "L'accesso SSH tramite password è abilitato. Si raccomanda di utilizzare chiavi SSH pubbliche e disattivare le password.",
                "fix_command": "sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/g' /etc/ssh/sshd_config && systemctl restart ssh"
            })
        else:
            checks.append({
                "id": "ssh_password_auth",
                "name": "Autenticazione SSH con Password",
                "category": "Access",
                "status": "secure",
                "value": "Disabilitata (Solo chiavi)",
                "description": "L'autenticazione tramite password è disattivata. Si accede solo tramite chiavi pubbliche configurate.",
                "fix_command": None
            })
    else:
        checks.append({
            "id": "ssh_config",
            "name": "Configurazione Servizio SSH",
            "category": "Access",
            "status": "warning",
            "value": "Non rilevabile",
            "description": "Impossibile caricare o analizzare i parametri del demone SSH sul server host.",
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
                        "name": "Permessi del Socket Docker",
                        "category": "Docker",
                        "status": "risk",
                        "value": f"Insicuri ({mode})",
                        "description": "Il socket di Docker ha permessi di scrittura pubblici. Chiunque sul server host può ottenere il controllo root.",
                        "fix_command": "chmod 660 /var/run/docker.sock"
                    })
                else:
                    checks.append({
                        "id": "docker_sock_perms",
                        "name": "Permessi del Socket Docker",
                        "category": "Docker",
                        "status": "secure",
                        "value": f"Sicuri ({mode} - {group})",
                        "description": "Il socket Docker ha permessi limitati agli utenti autorizzati (proprietario o gruppo docker).",
                        "fix_command": None
                    })
            else:
                checks.append({
                    "id": "docker_sock_perms",
                    "name": "Permessi del Socket Docker",
                    "category": "Docker",
                    "status": "warning",
                    "value": "Non verificabili",
                    "description": "Impossibile ottenere i permessi di sicurezza del socket Docker.",
                    "fix_command": None
                })
        except:
            pass
    else:
        checks.append({
            "id": "docker_sock_perms",
            "name": "Permessi del Socket Docker",
            "category": "Docker",
            "status": "warning",
            "value": "Socket non trovato",
            "description": "Il socket Docker non è stato trovato nella directory standard (/var/run/docker.sock).",
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
                "name": "Aggiornamenti di Sicurezza Pendenti",
                "category": "System",
                "status": "risk",
                "value": f"{sec_updates} critici ({tot_updates} totali)",
                "description": f"Ci sono {sec_updates} aggiornamenti di sicurezza non installati sull'host. Il sistema potrebbe essere vulnerabile ad exploit noti.",
                "fix_command": "apt-get update && apt-get upgrade -y"
            })
        elif tot_updates > 0:
            checks.append({
                "id": "system_updates",
                "name": "Aggiornamenti di Sicurezza Pendenti",
                "category": "System",
                "status": "warning",
                "value": f"{tot_updates} aggiornamenti disponibili",
                "description": "Nessun aggiornamento di sicurezza critico in sospeso, ma ci sono pacchetti generici da aggiornare.",
                "fix_command": "apt-get update && apt-get upgrade -y"
            })
        else:
            checks.append({
                "id": "system_updates",
                "name": "Aggiornamenti di Sicurezza Pendenti",
                "category": "System",
                "status": "secure",
                "value": "Sistema Aggiornato",
                "description": "Non ci sono aggiornamenti in sospeso per il sistema operativo host.",
                "fix_command": None
            })
    else:
        checks.append({
            "id": "system_updates",
            "name": "Aggiornamenti di Sicurezza Pendenti",
            "category": "System",
            "status": "warning",
            "value": "Non verificabile",
            "description": "Impossibile recuperare lo stato degli aggiornamenti APT dell'host.",
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
                            exposed_containers.append(f"{c_name} (Porta {public_port})")
    except Exception as e:
        print(f"Docker API parse warning: {e}")
        
    if exposed_containers:
        checks.append({
            "id": "docker_exposed_ports",
            "name": "Esposizione Porte Sensibili",
            "category": "Docker",
            "status": "warning",
            "value": f"{len(exposed_containers)} esposte",
            "description": f"I seguenti servizi sensibili nei container sono esposti a tutto internet (0.0.0.0): {', '.join(exposed_containers)}.",
            "fix_command": "Configurare i binding in docker-compose su 127.0.0.1 anziché 0.0.0.0"
        })
    else:
        checks.append({
            "id": "docker_exposed_ports",
            "name": "Esposizione Porte Sensibili",
            "category": "Docker",
            "status": "secure",
            "value": "Nessuna porta esposta",
            "description": "Nessun database o porta critica nei container Docker è esposta direttamente all'esterno.",
            "fix_command": None
        })

    # Calculate global security status
    risks_count = sum(1 for c in checks if c["status"] == "risk")
    warnings_count = sum(1 for c in checks if c["status"] == "warning")
    
    if risks_count > 0:
        global_status = "risk"
        global_message = "Il server presenta vulnerabilità critiche che richiedono attenzione immediata!"
    elif warnings_count > 0:
        global_status = "warning"
        global_message = "Il server è parzialmente sicuro, ma presenta alcuni avvertimenti."
    else:
        global_status = "secure"
        global_message = "Il server è configurato secondo le principali raccomandazioni di sicurezza!"
        
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
        return jsonify({"success": False, "error": "Parametri insufficienti"}), 400
        
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
        return jsonify({"success": False, "error": "Azione correttiva non autorizzata o non sicura."}), 403
        
    # Execute the fix
    res = run_host_command(fix_cmd)
    success = (res.get("returncode") == 0)
    
    return jsonify({
        "success": success,
        "stdout": res.get("stdout"),
        "stderr": res.get("stderr"),
        "message": "Azione correttiva eseguita con successo!" if success else f"Errore durante l'esecuzione: {res.get('stderr')}"
    })
