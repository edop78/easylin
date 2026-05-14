from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
import socket
import platform

system_bp = Blueprint("system", __name__)

@system_bp.route("/info", methods=["GET"])
@jwt_required()
def system_info():
    return jsonify({
        "hostname": socket.gethostname(),
        "os": platform.system(),
        "kernel": platform.release(),
        "arch": platform.machine()
    })
