"""Reverse Proxy (Nginx) management API."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from utils.command import run_host_command
from database import get_db

proxy_bp = Blueprint("proxy", __name__)


@proxy_bp.route("/status", methods=["GET"])
@jwt_required()
def nginx_status():
    """Check if Nginx is installed and running."""
    installed = run_host_command("which nginx")
    status = run_host_command("systemctl is-active nginx")

    return jsonify({
        "installed": installed["returncode"] == 0,
        "running": status["stdout"].strip() == "active",
    })


@proxy_bp.route("/install", methods=["POST"])
@jwt_required()
def install_nginx():
    """Install Nginx."""
    result = run_host_command(
        "DEBIAN_FRONTEND=noninteractive apt-get install -y nginx",
        timeout=120,
    )
    return jsonify({
        "success": result["returncode"] == 0,
        "output": result["stdout"],
        "error": result["stderr"],
    })


@proxy_bp.route("/sites", methods=["GET"])
@jwt_required()
def list_sites():
    """List Nginx site configurations."""
    enabled = run_host_command("ls /etc/nginx/sites-enabled/ 2>/dev/null")
    available = run_host_command("ls /etc/nginx/sites-available/ 2>/dev/null")

    return jsonify({
        "enabled": enabled["stdout"].split("\n") if enabled["stdout"] else [],
        "available": available["stdout"].split("\n") if available["stdout"] else [],
    })


@proxy_bp.route("/sites", methods=["POST"])
@jwt_required()
def create_site():
    """Create a new reverse proxy site configuration."""
    data = request.get_json()
    domain = data.get("domain", "").strip()
    upstream_host = data.get("upstream_host", "127.0.0.1")
    upstream_port = data.get("upstream_port", 80)

    if not domain:
        return jsonify({"error": "Domain is required"}), 400

    config = f"""server {{
    listen 80;
    server_name {domain};

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

    # Write config file
    result = run_host_command(
        f"cat > /etc/nginx/sites-available/{domain} << 'EOFCONFIG'\n{config}EOFCONFIG"
    )
    if result["returncode"] != 0:
        return jsonify({"error": result["stderr"]}), 500

    # Enable site
    run_host_command(
        f"ln -sf /etc/nginx/sites-available/{domain} /etc/nginx/sites-enabled/{domain}"
    )

    # Test and reload
    test = run_host_command("nginx -t")
    if test["returncode"] != 0:
        return jsonify({"error": f"Nginx config test failed: {test['stderr']}"}), 500

    run_host_command("systemctl reload nginx")

    # Save to database
    db = get_db()
    db.execute(
        "INSERT INTO proxy_configs (domain, upstream_host, upstream_port) VALUES (?, ?, ?)",
        (domain, upstream_host, upstream_port),
    )
    db.commit()
    db.close()

    return jsonify({"success": True, "domain": domain})


@proxy_bp.route("/sites/<domain>", methods=["DELETE"])
@jwt_required()
def delete_site(domain):
    """Delete a site configuration."""
    run_host_command(f"rm -f /etc/nginx/sites-enabled/{domain}")
    run_host_command(f"rm -f /etc/nginx/sites-available/{domain}")
    run_host_command("systemctl reload nginx")

    db = get_db()
    db.execute("DELETE FROM proxy_configs WHERE domain = ?", (domain,))
    db.commit()
    db.close()

    return jsonify({"success": True})


@proxy_bp.route("/sites/<domain>/config", methods=["GET"])
@jwt_required()
def get_site_config(domain):
    """Get the Nginx config for a site."""
    result = run_host_command(f"cat /etc/nginx/sites-available/{domain}")
    return jsonify({"config": result["stdout"], "error": result["stderr"]})
