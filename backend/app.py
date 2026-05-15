import os
import sys
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman

# Aggiungi la root al path per sicurezza assoluta
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import Config
from database import init_db

def create_app():
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    app = Flask(__name__, static_folder=static_dir, static_url_path="")
    
    # Configurazione
    app.config.from_object(Config)
    
    # Sicurezza: HTTPS (se possibile) e Headers
    Talisman(app, 
             content_security_policy=None, # Disabilitato per semplicità SPA, da affinare in prod
             force_https=False) # Gestito solitamente dal proxy inverso

    # Rate Limiting
    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=["200 per day", "50 per hour"],
        storage_uri="memory://",
    )
    
    # Rendi il limiter accessibile globalmente se necessario (opzionale)
    app.limiter = limiter

    # Inizializza database
    try:
        init_db()
    except Exception as e:
        print(f"Error initializing database: {e}")
    
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
        ("modules.git_projects.routes", "git_projects_bp", "/api/git"),
        ("modules.storage.routes", "storage_bp", "/api/storage"),
        ("modules.ai.routes", "ai_bp", "/api/ai"),
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

    @app.route("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    @app.errorhandler(404)
    def not_found(e):
        # Se la richiesta è per un'API, restituisci JSON
        if request.path.startswith("/api/"):
            return jsonify({"error": "Not Found", "path": request.path}), 404
        # Altrimenti, servi la SPA
        return send_from_directory(app.static_folder, "index.html")

    @app.errorhandler(Exception)
    def handle_exception(e):
        # Log dell'errore (opzionale, ma utile)
        app.logger.error(f"Unhandled Exception: {e}")
        # Se la richiesta è per un'API, restituisci JSON
        if request.path.startswith("/api/"):
            return jsonify({
                "error": "Internal Server Error",
                "message": str(e)
            }), 500
        # Altrimenti, servi la SPA o un errore generico
        return send_from_directory(app.static_folder, "index.html")

    return app

if __name__ == "__main__":
    application = create_app()
    application.run(host="0.0.0.0", port=5050)
