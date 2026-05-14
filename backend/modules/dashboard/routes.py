from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
import psutil

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/metrics")
@jwt_required()
def get_metrics():
    return jsonify({
        "cpu": psutil.cpu_percent(),
        "ram": {"percent": psutil.virtual_memory().percent},
        "disk": {"percent": psutil.disk_usage('/').percent},
        "load": [0,0,0],
        "net": {"sent": 0, "recv": 0}
    })
