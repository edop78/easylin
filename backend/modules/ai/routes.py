from flask import Blueprint, request, jsonify, Response
import requests
import json
from flask_jwt_extended import jwt_required

ai_bp = Blueprint("ai", __name__)

# Primary is 127.0.0.1 since EasyLin runs in network_mode: host
OLLAMA_API = "http://127.0.0.1:11434/api"

import socket

def get_local_ip():
    try:
        # Create a dummy socket to detect the preferred local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

import concurrent.futures

def probe_url(url):
    try:
        res = requests.get(url, timeout=1.0)
        if res.status_code == 200 and "ollama" in res.text.lower():
            return url
    except:
        pass
    return None

def check_ollama():
    """Detect Ollama by probing common endpoints and scanning the local subnet."""
    global OLLAMA_API
    local_ip = get_local_ip()
    base_ip = ".".join(local_ip.split(".")[:-1]) + "."
    
    endpoints = [
        "http://127.0.0.1:11434/",
        "http://localhost:11434/",
        f"http://{local_ip}:11434/",
        "http://host.docker.internal:11434/",
        "http://ollama:11434/"
    ]
    
    # 1. Try common endpoints first (fast)
    for url in endpoints:
        if probe_url(url):
            OLLAMA_API = f"{url.rstrip('/')}/api"
            return True

    # 2. Parallel scan of the subnet (brute force)
    scan_urls = [f"http://{base_ip}{i}:11434/" for i in range(1, 255)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        future_to_url = {executor.submit(probe_url, url): url for url in scan_urls}
        for future in concurrent.futures.as_completed(future_to_url):
            found_url = future.result()
            if found_url:
                OLLAMA_API = f"{found_url.rstrip('/')}/api"
                return True
            
    return False

@ai_bp.route("/status", methods=["GET"])
@jwt_required()
def get_status():
    local_ip = get_local_ip()
    is_active = check_ollama()
    return jsonify({
        "active": is_active,
        "api_url": OLLAMA_API,
        "detected_ip": local_ip,
        "message": "Ollama is running" if is_active else f"Ollama not reachable at {OLLAMA_API}. Detected host IP: {local_ip}"
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

    if not check_ollama():
        return jsonify({"error": "Ollama offline"}), 503

    try:
        # We use stream=True to avoid loading the entire response into memory,
        # but we iterate through it and return only the final result.
        res = requests.post(f"{OLLAMA_API}/pull", json={"name": model_name}, stream=True, timeout=None)
        
        final_status = "unknown"
        for line in res.iter_lines():
            if line:
                try:
                    chunk = json.loads(line.decode('utf-8'))
                    if 'status' in chunk:
                        final_status = chunk['status']
                    if 'error' in chunk:
                        return jsonify({"error": chunk['error']}), 400
                except:
                    continue
        
        if final_status == "success":
            return jsonify({"success": True, "message": f"Model {model_name} pulled successfully"})
        else:
            return jsonify({"success": True, "message": f"Pull finished with status: {final_status}"})
                
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
            "stream": False
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
