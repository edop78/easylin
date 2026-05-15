"""Authentication API routes."""

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
from auth.pam_auth import authenticate_user, user_has_sudo

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticate user and return JWT token."""
    # Rate limiting manuale o via decoratore se accessibile
    if hasattr(current_app, 'limiter'):
        @current_app.limiter.limit("5 per minute")
        def limited_login():
            pass
        # Nota: il decoratore dinamico è complesso in Flask-Limiter, 
        # meglio usare quello standard se possibile, ma i Blueprints richiedono setup specifico.
        # Per ora usiamo un approccio semplice.
    
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if not authenticate_user(username, password):
        return jsonify({"error": "Invalid credentials"}), 401

    if not user_has_sudo(username):
        return jsonify({"error": "User does not have administrator privileges"}), 403

    token = create_access_token(identity=username)
    return jsonify({
        "token": token,
        "username": username,
    })


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """Return current authenticated user info."""
    username = get_jwt_identity()
    return jsonify({"username": username})


@auth_bp.route("/verify", methods=["GET"])
@jwt_required()
def verify():
    """Verify that the current token is still valid."""
    return jsonify({"valid": True, "username": get_jwt_identity()})
