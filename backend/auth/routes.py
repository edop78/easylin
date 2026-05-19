"""Authentication API routes."""

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
from auth.pam_auth import authenticate_user, user_has_sudo

import time
import socket

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/server-info", methods=["GET"])
def server_info():
    """Return basic public info about the server for the login page."""
    hostname = "localhost"
    try:
        import os
        if os.path.exists("/host/etc/hostname"):
            with open("/host/etc/hostname", "r") as f:
                hostname = f.read().strip()
        else:
            import subprocess
            res = subprocess.run(
                ["nsenter", "--target", "1", "--uts", "hostname"],
                capture_output=True,
                text=True,
                timeout=2
            )
            if res.returncode == 0:
                hostname = res.stdout.strip()
            else:
                hostname = socket.gethostname()
    except Exception:
        try:
            hostname = socket.gethostname()
        except Exception:
            hostname = "localhost"
        
    response = jsonify({
        "hostname": hostname
    })
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response


# Simple IP-based in-memory rate limiter for failed login attempts
FAILED_LOGINS = {} # ip -> list of timestamps of failed attempts

def check_login_rate_limit(ip):
    now = time.time()
    # Clean up old timestamps (older than 60 seconds)
    if ip in FAILED_LOGINS:
        FAILED_LOGINS[ip] = [t for t in FAILED_LOGINS[ip] if now - t < 60]
        if len(FAILED_LOGINS[ip]) >= 5:
            return False
    return True

def record_failed_login(ip):
    now = time.time()
    if ip not in FAILED_LOGINS:
        FAILED_LOGINS[ip] = []
    FAILED_LOGINS[ip].append(now)


@auth_bp.route("/login", methods=["POST"])
def login():
    ip = request.remote_addr
    if not check_login_rate_limit(ip):
        return jsonify({
            "error": "Rate limit exceeded",
            "message": "Too many failed login attempts. Please try again in 1 minute."
        }), 429
    
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if not authenticate_user(username, password):
        record_failed_login(ip)
        return jsonify({"error": "Invalid credentials"}), 401

    if not user_has_sudo(username):
        return jsonify({"error": "User does not have administrator privileges"}), 403

    # On successful login, clear the failures for this IP
    if ip in FAILED_LOGINS:
        del FAILED_LOGINS[ip]

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
