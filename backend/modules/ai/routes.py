from flask import Blueprint, request, jsonify, Response
import requests
import json
import os
from flask_jwt_extended import jwt_required
try:
    from backend.database import get_db
except ImportError:
    from database import get_db

from .executor import AVAILABLE_TOOLS, TOOLS_DEFINITION
try:
    from backend.config import Config
except ImportError:
    from config import Config

ai_bp = Blueprint("ai", __name__)

# Primary is 127.0.0.1 since EasyLin runs in network_mode: host
OLLAMA_API = "http://127.0.0.1:11434/api"

import socket
import concurrent.futures

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def probe_url(url):
    try:
        res = requests.get(url, timeout=1.0)
        if res.status_code == 200 and "ollama" in res.text.lower():
            return url
    except:
        pass
    return None

def check_ollama():
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
    for url in endpoints:
        if probe_url(url):
            OLLAMA_API = f"{url.rstrip('/')}/api"
            return True
    return False

@ai_bp.route("/status", methods=["GET"])
@jwt_required()
def get_status():
    is_active = check_ollama()
    return jsonify({"active": is_active, "api_url": OLLAMA_API})

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

SYSTEM_PROMPT = """You are the EasyLin Autonomous AI Agent. 
You have DIRECT access to the host system via specialized tools. 

CRITICAL PROTOCOLS:
1. TOOL VERIFICATION: Never tell the user that an action (start, stop, delete, etc.) is completed unless the tool explicitly returns a "SUCCESS" message. If a tool returns "FAILED" or "ERROR", you MUST report the failure and explain the technical reason.
2. AUTONOMY: If you need to act on a container but don't have its ID/Name, use 'list_containers' first. Do not bother the user with technical details you can find yourself.
3. TRUTH: Do not hallucinate success. If you are unsure, use 'list_containers' to verify the current state before and after your actions.
4. BE CONCISE: Avoid long preambles. Act first, then report briefly.
"""

@ai_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    data = request.get_json()
    model = data.get("model")
    messages = data.get("messages", [])
    
    if not model or not messages:
        return jsonify({"error": "Model and messages required"}), 400

    # Save user message
    user_msg = messages[-1]
    conn = get_db()
    conn.execute("INSERT INTO chat_messages (model, role, content) VALUES (?, ?, ?)", (model, user_msg['role'], user_msg['content']))
    conn.commit()
    conn.close()

    def generate():
        # Inject system prompt if not present
        current_messages = messages.copy()
        if not any(m.get('role') == 'system' for m in current_messages):
            current_messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})
            
        assistant_full_content = ""
        
        for turn in range(5):
            try:
                res = requests.post(f"{OLLAMA_API}/chat", json={
                    "model": model,
                    "messages": current_messages,
                    "tools": TOOLS_DEFINITION,
                    "stream": True 
                }, stream=True, timeout=120)
                
                tool_calls = []
                turn_assistant_message = {"role": "assistant", "content": ""}
                
                for line in res.iter_lines():
                    if line:
                        chunk = json.loads(line.decode('utf-8'))
                        msg_chunk = chunk.get('message', {})
                        if msg_chunk.get('tool_calls'):
                            tool_calls.extend(msg_chunk['tool_calls'])
                        content = msg_chunk.get('content', '')
                        if content:
                            turn_assistant_message['content'] += content
                            assistant_full_content += content
                            yield f"data: {json.dumps({'content': content})}\n\n"
                        if chunk.get('done'): break
                
                if not tool_calls:
                    if assistant_full_content:
                        db_conn = get_db()
                        db_conn.execute("INSERT INTO chat_messages (model, role, content) VALUES (?, ?, ?)", (model, 'assistant', assistant_full_content))
                        db_conn.commit()
                        db_conn.close()
                    return

                current_messages.append(turn_assistant_message)
                for tool_call in tool_calls:
                    func_name = tool_call.get('function', {}).get('name')
                    args = tool_call.get('function', {}).get('arguments', {})
                    if func_name in AVAILABLE_TOOLS:
                        yield f"data: {json.dumps({'status': f'AI is using {func_name}...'})}\n\n"
                        result = AVAILABLE_TOOLS[func_name](**args)
                        current_messages.append({"role": "tool", "content": str(result), "name": func_name})
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                return

    return Response(generate(), mimetype='text/event-stream')

@ai_bp.route("/chat/history", methods=["GET"])
@jwt_required()
def get_chat_history():
    model = request.args.get("model")
    conn = get_db()
    if model:
        cursor = conn.execute("SELECT role, content FROM chat_messages WHERE model = ? ORDER BY created_at ASC", (model,))
    else:
        cursor = conn.execute("SELECT role, content FROM chat_messages ORDER BY created_at ASC")
    messages = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({"messages": messages})

@ai_bp.route("/chat/clear", methods=["POST"])
@jwt_required()
def clear_chat_history():
    data = request.get_json() or {}
    model = data.get("model")
    conn = get_db()
    if model:
        conn.execute("DELETE FROM chat_messages WHERE model = ?", (model,))
    else:
        conn.execute("DELETE FROM chat_messages")
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@ai_bp.route("/permissions", methods=["GET"])
@jwt_required()
def get_permissions():
    conn = get_db()
    cursor = conn.execute("SELECT * FROM ai_permissions")
    permissions = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({"permissions": permissions})

@ai_bp.route("/permissions", methods=["POST"])
@jwt_required()
def update_permission():
    data = request.get_json()
    capability = data.get("capability")
    enabled = 1 if data.get("enabled") else 0
    conn = get_db()
    conn.execute("UPDATE ai_permissions SET enabled = ? WHERE capability = ?", (enabled, capability))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@ai_bp.route("/pull", methods=["POST"])
@jwt_required()
def pull_model():
    data = request.get_json()
    model_name = data.get("name")
    if not model_name: return jsonify({"error": "Model name required"}), 400
    if not check_ollama(): return jsonify({"error": "Ollama offline"}), 503
    try:
        res = requests.post(f"{OLLAMA_API}/pull", json={"name": model_name}, stream=True, timeout=None)
        final_status = "unknown"
        for line in res.iter_lines():
            if line:
                chunk = json.loads(line.decode('utf-8'))
                if 'status' in chunk: final_status = chunk['status']
                if 'error' in chunk: return jsonify({"error": chunk['error']}), 400
        return jsonify({"success": True, "message": f"Pull finished: {final_status}"})
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
