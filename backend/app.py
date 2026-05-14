import os
import sys
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

# Aggiungi la root al path per sicurezza
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def create_app():
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    app = Flask(__name__, static_folder=static_dir, static_url_path="")
    
    # Configurazione minima
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-key")
    app.config["JWT_SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-key")
    
    CORS(app, supports_credentials=True)
    JWTManager(app)

    # Registrazione Blueprints con protezione
    try:
        from auth.routes import auth_bp
        app.register_blueprint(auth_bp, url_prefix="/api/auth")
        
        from modules.dashboard.routes import dashboard_bp
        app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
        
        from modules.system.routes import system_bp
        app.register_blueprint(system_bp, url_prefix="/api/system")
        
        from modules.packages.routes import packages_bp
        app.register_blueprint(packages_bp, url_prefix="/api/packages")
        
        from modules.docker_mgmt.routes import docker_bp
        app.register_blueprint(docker_bp, url_prefix="/api/docker")
    except Exception as e:
        print(f"CRITICAL ERROR REGISTERING BLUEPRINTS: {e}")

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "message": "Backend is alive"})

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
