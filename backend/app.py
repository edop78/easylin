import os
import sys
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

# Aggiungi la root al path per sicurezza assoluta
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def create_app():
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    app = Flask(__name__, static_folder=static_dir, static_url_path="")
    
    # Configurazione
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-key")
    app.config["JWT_SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-key")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 86400 # 24 ore
    
    CORS(app, supports_credentials=True)
    JWTManager(app)

    # Elenco dei moduli da caricare
    modules = [
        ("auth.routes", "auth_bp", "/api/auth"),
        ("modules.dashboard.routes", "dashboard_bp", "/api/dashboard"),
        ("modules.system.routes", "system_bp", "/api/system"),
        ("modules.packages.routes", "packages_bp", "/api/packages"),
        ("modules.users.routes", "users_bp", "/api/users"),
        ("modules.services.routes", "services_bp", "/api/services"),
        ("modules.docker_mgmt.routes", "docker_bp", "/api/docker"),
        ("modules.network.routes", "network_bp", "/api/network"),
        ("modules.firewall.routes", "firewall_bp", "/api/firewall"),
        ("modules.reverse_proxy.routes", "proxy_bp", "/api/proxy"),
        ("modules.files.routes", "files_bp", "/api/files"),
        ("modules.terminal.routes", "terminal_bp", "/api/terminal"),
        ("modules.logs.routes", "logs_bp", "/api/logs"),
    ]

    for module_path, bp_name, prefix in modules:
        try:
            mod = __import__(module_path, fromlist=[bp_name])
            bp = getattr(mod, bp_name)
            app.register_blueprint(bp, url_prefix=prefix)
        except Exception as e:
            print(f"Warning: Could not load module {module_path}: {e}")

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "app": "EasyLin"})

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_spa(path):
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, "index.html")

    return app

if __name__ == "__main__":
    application = create_app()
    application.run(host="0.0.0.0", port=5050)
