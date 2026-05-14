"""EasyLin — Flask application factory."""

import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from database import init_db


def create_app():
    """Create and configure the Flask application."""
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    app = Flask(__name__, static_folder=static_dir, static_url_path="")
    app.config.from_object(Config)

    # Extensions
    CORS(app, supports_credentials=True)
    JWTManager(app)

    # Initialize database
    init_db()

    # --- Register API blueprints ---
    from auth.routes import auth_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    from modules.dashboard.routes import dashboard_bp
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")

    from modules.system.routes import system_bp
    app.register_blueprint(system_bp, url_prefix="/api/system")

    from modules.packages.routes import packages_bp
    app.register_blueprint(packages_bp, url_prefix="/api/packages")

    from modules.users.routes import users_bp
    app.register_blueprint(users_bp, url_prefix="/api/users")

    from modules.services.routes import services_bp
    app.register_blueprint(services_bp, url_prefix="/api/services")

    from modules.docker_mgmt.routes import docker_bp
    app.register_blueprint(docker_bp, url_prefix="/api/docker")

    from modules.network.routes import network_bp
    app.register_blueprint(network_bp, url_prefix="/api/network")

    from modules.firewall.routes import firewall_bp
    app.register_blueprint(firewall_bp, url_prefix="/api/firewall")

    from modules.reverse_proxy.routes import proxy_bp
    app.register_blueprint(proxy_bp, url_prefix="/api/proxy")

    from modules.files.routes import files_bp
    app.register_blueprint(files_bp, url_prefix="/api/files")

    from modules.terminal.routes import terminal_bp
    app.register_blueprint(terminal_bp, url_prefix="/api/terminal")

    from modules.logs.routes import logs_bp
    app.register_blueprint(logs_bp, url_prefix="/api/logs")

    # --- Serve React SPA ---
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_spa(path):
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, "index.html")

    return app


if __name__ == "__main__":
    application = create_app()
    application.run(host="0.0.0.0", port=5050, debug=False)
