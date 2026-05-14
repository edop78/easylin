"""Reverse Proxy (Nginx) management API with SSL support."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import sys
import os

proxy_bp = Blueprint("proxy", __name__)

# Helper to import run_host_command safely
def get_run_command():
    try:
        from backend.utils.command import run_host_command
        return run_host_command
    except ImportError:
        try:
            from utils.command import run_host_command
            return run_host_command
        except ImportError:
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
            try:
                from backend.utils.command import run_host_command
                return run_host_command
            except:
                return lambda cmd, **kwargs: {"stdout": "", "stderr": "Command utility not found", "returncode": 1}

run_host_command = get_run_command()

@proxy_bp.route("/status", methods=["GET"])
@jwt_required()
def nginx_status():
    """Check if Nginx and Certbot are installed."""
    installed = run_host_command("which nginx")
    status = run_host_command("systemctl is-active nginx")
    certbot = run_host_command("which certbot")

    return jsonify({
        "installed": installed["returncode"] == 0,
        "running": status["stdout"].strip() == "active",
        "certbot_installed": certbot["returncode"] == 0
    })

@proxy_bp.route("/install", methods=["POST"])
@jwt_required()
def install_proxy_stack():
    """Install Nginx and Certbot."""
    # Install nginx and python3-certbot-nginx
    result = run_host_command(
        "DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx",
        timeout=300
    )
    return jsonify({
        "success": result["returncode"] == 0,
        "output": result["stdout"],
        "error": result.get("stderr", "")
    })

@proxy_bp.route("/sites", methods=["GET"])
@jwt_required()
def list_sites():
    enabled = run_host_command("ls /etc/nginx/sites-enabled/ 2>/dev/null")
    return jsonify({
        "enabled": enabled["stdout"].split("\n") if enabled["stdout"] else []
    })

@proxy_bp.route("/sites", methods=["POST"])
@jwt_required()
def create_site():
    """Create a new reverse proxy site configuration with advanced options."""
    data = request.get_json()
    domain = data.get("domain", "").strip()
    upstream_host = data.get("upstream_host", "127.0.0.1")
    upstream_port = data.get("upstream_port", 80)
    max_body = data.get("max_body", "100") # in MB
    use_ssl = data.get("use_ssl", False)
    email = data.get("email", "admin@" + domain)

    if not domain:
        return jsonify({"error": "Domain is required"}), 400

    # Professional Nginx Template
    config = f"""server {{
    listen 80;
    server_name {domain};
    client_max_body_size {max_body}M;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";

    location / {{
        proxy_pass http://{upstream_host}:{upstream_port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }}
}}
"""

    # 1. Write config file
    write_res = run_host_command(f"cat > /etc/nginx/sites-available/{domain} << 'EOFCONFIG'\n{config}EOFCONFIG")
    if write_res["returncode"] != 0:
        return jsonify({"error": f"Failed to write config: {write_res['stderr']}"}), 500

    # 2. Enable site
    run_host_command(f"ln -sf /etc/nginx/sites-available/{domain} /etc/nginx/sites-enabled/{domain}")

    # 3. Test and reload for HTTP first
    test = run_host_command("nginx -t")
    if test["returncode"] != 0:
        return jsonify({"error": f"Nginx config test failed: {test['stderr']}"}), 500
    
    run_host_command("systemctl reload nginx")

    # 4. Handle SSL if requested
    ssl_success = False
    ssl_error = ""
    if use_ssl:
        # Run certbot to get certificate and auto-configure nginx
        # --nginx plugin handles the config change
        cert_cmd = f"certbot --nginx -d {domain} --non-interactive --agree-tos -m {email} --redirect"
        cert_res = run_host_command(cert_cmd, timeout=120)
        ssl_success = cert_res["returncode"] == 0
        ssl_error = cert_res.get("stderr", cert_res.get("stdout", ""))

    return jsonify({
        "success": True, 
        "domain": domain, 
        "ssl_active": ssl_success,
        "ssl_error": ssl_error if not ssl_success and use_ssl else None
    })

@proxy_bp.route("/sites/<domain>", methods=["DELETE"])
@jwt_required()
def delete_site(domain):
    run_host_command(f"rm -f /etc/nginx/sites-enabled/{domain}")
    run_host_command(f"rm -f /etc/nginx/sites-available/{domain}")
    run_host_command("systemctl reload nginx")
    return jsonify({"success": True})

@proxy_bp.route("/sites/<domain>/config", methods=["GET"])
@jwt_required()
def get_site_config(domain):
    result = run_host_command(f"cat /etc/nginx/sites-available/{domain}")
    return jsonify({"config": result["stdout"], "error": result["stderr"]})
