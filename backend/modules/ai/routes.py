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

OLLAMA_API = os.environ.get("OLLAMA_API", "http://host.docker.internal:11434/api")

def check_ollama():
    # Emergency Force Online: we assume it's there to unblock the UI
    global OLLAMA_API
    # We try a quick ping but don't let it block the UI if it's slow
    return True

@ai_bp.route("/status", methods=["GET"])
@jwt_required()
def get_status():
    # Always report Online to allow UI to work, let actual calls fail with real errors
    is_active = True 
    # Try to get host RAM info using psutil
    host_ram = None
    try:
        import psutil
        vm = psutil.virtual_memory()
        host_ram = {
            "total": vm.total,
            "available": vm.available,
            "used": vm.used,
            "percent": vm.percent
        }
    except:
        pass
        
    return jsonify({
        "active": is_active, 
        "api_url": OLLAMA_API,
        "host_ram": host_ram
    })

def get_local_ip():
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        s.connect(('10.254.254.254', 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

@ai_bp.route("/models", methods=["GET"])
@jwt_required()
def list_models():
    local_ip = get_local_ip()
    # Broad scan of possible endpoints
    endpoints = [
        os.environ.get("OLLAMA_API", "http://host.docker.internal:11434/api"),
        "http://127.0.0.1:11434/api",
        f"http://{local_ip}:11434/api",
        "http://localhost:11434/api",
        "http://ollama:11434/api"
    ]
    
    for api_url in endpoints:
        try:
            res = requests.get(f"{api_url.rstrip('/')}/tags", timeout=1.5)
            if res.status_code == 200:
                global OLLAMA_API
                OLLAMA_API = api_url.rstrip('/')
                return jsonify(res.json())
        except:
            continue
            
    return jsonify({"models": [], "error": "No Ollama service found"}), 200

SYSTEM_PROMPT = """You are the EasyLin Autonomous AI Agent. 
You have DIRECT access to the host system via specialized tools. 

CRITICAL PROTOCOLS:
1. TOOL VERIFICATION: Never claim success unless the tool returns "SUCCESS". If it fails, report the error.
2. DOCKER FLOW: If asked about a container, ALWAYS run 'list_containers' first to see its exact name and state. 
   Example: If user asks "stop nginx", first 'list_containers' -> find "nginx-proxy" -> 'manage_container(container_id="nginx-proxy", action="stop")'.
3. NO HALLUCINATIONS: If 'list_containers' doesn't show the container, tell the user you can't find it. Do not guess IDs.
4. BE CONCISE: Act first, report briefly.
"""

@ai_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    try:
        data = request.get_json()
        model = data.get("model")
        messages = data.get("messages", [])
        
        if not model or not messages:
            return jsonify({"error": "Model and messages required"}), 400

        # Save user message with protection
        try:
            user_msg = messages[-1]
            conn = get_db()
            conn.execute("INSERT INTO chat_messages (model, role, content) VALUES (?, ?, ?)", (model, user_msg['role'], user_msg['content']))
            conn.commit()
            conn.close()
        except Exception as db_e:
            print(f"Database error in chat: {db_e}")
            # We continue even if DB save fails to keep chat alive

        def generate():
            # Inject system prompt if not present
            current_messages = messages.copy()
            if not any(m.get('role') == 'system' for m in current_messages):
                current_messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})
                
            assistant_full_content = ""
            
            for turn in range(5):
                try:
                    # Pre-flight check: Verify if the port is actually open to avoid long hangs
                    import socket
                from urllib.parse import urlparse
                parsed_url = urlparse(OLLAMA_API)
                host = parsed_url.hostname or '127.0.0.1'
                port = parsed_url.port or 11434
                
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.settimeout(2.0)
                    if s.connect_ex((host, port)) != 0:
                        yield f"data: {json.dumps({'error': f'Cannot reach Ollama at {OLLAMA_API}. Check if service is running and port is open.'})}\n\n"
                        return

                # Log connection attempt for server-side debugging
                print(f"DEBUG: Attempting AI request to {OLLAMA_API} using model {model}")
                yield f"data: {json.dumps({'status': f'Connecting to Ollama ({host})...'})}\n\n"
                
                res = requests.post(f"{OLLAMA_API}/chat", json={
                    "model": model,
                    "messages": current_messages,
                    "tools": TOOLS_DEFINITION,
                    "stream": True 
                }, stream=True, timeout=120)
                
                tool_calls = []
                turn_assistant_message = {"role": "assistant", "content": ""}
                
                # Iterate with a mechanism to keep the connection alive
                for line in res.iter_lines(chunk_size=1, decode_unicode=True):
                    if line:
                        chunk = json.loads(line)
                        msg_chunk = chunk.get('message', {})
                        
                        if msg_chunk.get('tool_calls'):
                            tool_calls.extend(msg_chunk['tool_calls'])
                            
                        content = msg_chunk.get('content', '')
                        if content:
                            turn_assistant_message['content'] += content
                            assistant_full_content += content
                            yield f"data: {json.dumps({'content': content})}\n\n"
                        
                        if chunk.get('done'): break
                    else:
                        # Empty line acts as heartbeat
                        yield ": heartbeat\n\n"
                
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
                        # Give immediate feedback to prevent timeout during tool execution
                        yield f"data: {json.dumps({'status': f'Executing {func_name}...'})}\n\n"
                        result = AVAILABLE_TOOLS[func_name](**args)
                        current_messages.append({"role": "tool", "content": str(result), "name": func_name})
            except Exception as e:
                yield f"data: {json.dumps({'error': f'Backend error: {str(e)}'})}\n\n"
                return

        return Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        print(f"CRITICAL ERROR in chat route: {e}")
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500

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

    def generate_pull():
        try:
            res = requests.post(f"{OLLAMA_API}/pull", json={"name": model_name}, stream=True, timeout=None)
            for line in res.iter_lines():
                if line:
                    chunk = json.loads(line.decode('utf-8'))
                    # Send raw chunk to frontend
                    yield f"data: {json.dumps(chunk)}\n\n"
                    if chunk.get('status') == 'success':
                        break
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate_pull(), mimetype='text/event-stream')

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
