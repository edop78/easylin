from flask import Blueprint, request, jsonify, Response
import requests
import json
from flask_jwt_extended import jwt_required

ai_bp = Blueprint("ai", __name__)

OLLAMA_API = "http://localhost:11434/api"

def check_ollama():
    try:
        requests.get(f"http://localhost:11434/", timeout=2)
        return True
    except:
        return False

@ai_bp.route("/status", methods=["GET"])
@jwt_required()
def get_status():
    is_active = check_ollama()
    return jsonify({
        "active": is_active,
        "api_url": OLLAMA_API,
        "message": "Ollama is running" if is_active else "Ollama is not reachable. Is it installed and running on port 11434?"
    })

@ai_bp.route("/models", methods=["GET"])
@jwt_required()
def list_models():
    if not check_ollama():
        return jsonify({"models": [], "error": "Ollama offline"}), 503
    
    try:
        res = requests.get(f"{OLLAMA_API}/tags")
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@ai_bp.route("/pull", methods=["POST"])
@jwt_required()
def pull_model():
    data = request.get_json()
    model_name = data.get("name")
    
    if not model_name:
        return jsonify({"error": "Model name required"}), 400

    def generate():
        res = requests.post(f"{OLLAMA_API}/pull", json={"name": model_name}, stream=True)
        for line in res.iter_lines():
            if line:
                yield line.decode('utf-8') + "\n"
                
    return Response(generate(), mimetype='application/json')

@ai_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    data = request.get_json()
    model = data.get("model")
    messages = data.get("messages", [])
    
    if not model or not messages:
        return jsonify({"error": "Model and messages required"}), 400

    try:
        res = requests.post(f"{OLLAMA_API}/chat", json={
            "model": model,
            "messages": messages,
            "stream": False # Semplifichiamo per ora senza streaming in chat
        })
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@ai_bp.route("/delete", methods=["DELETE"])
@jwt_required()
def delete_model():
    data = request.get_json()
    model_name = data.get("name")
    
    try:
        res = requests.delete(f"{OLLAMA_API}/delete", json={"name": model_name})
        return jsonify({"success": True, "message": f"Model {model_name} deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
