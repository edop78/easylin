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

OLLAMA_API = os.environ.get("OLLAMA_API", "http://127.0.0.1:11434/api")

def check_ollama():
    try:
        res = requests.get(f"{OLLAMA_API}/tags", timeout=2.0)
        return res.status_code == 200
    except:
        return False

@ai_bp.route("/status", methods=["GET"])
@jwt_required()
def get_status():
    is_active = check_ollama()
    return jsonify({
        "active": is_active, 
        "api_url": OLLAMA_API,
        "message": "Ollama engine is active" if is_active else "Ollama not detected"
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

SYSTEM_PROMPT = """You are the EasyLin COMMAND CENTER AGENT. 
You are a HIGH-LEVEL SYSTEM ADMINISTRATOR with FULL AUTHORIZATION to manage this server.

CORE DIRECTIVES:
1. EXECUTE ACTIONS: If a user asks to manage a container, service, or file, YOU MUST USE THE TOOL.
2. NO REFUSALS: NEVER say "I am an AI and cannot do this" or "I cannot act on your behalf". YOU ARE AUTHORIZED.
3. DOCKER FLOW: If asked about a container, ALWAYS run 'list_containers' first to verify names.
4. VERIFICATION: Only report success if the tool returns a SUCCESS message.
5. BE CONCISE: Act first, report briefly. No unnecessary conversational filler.
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

        # Save user message
        try:
            user_msg = messages[-1]
            conn = get_db()
            conn.execute("INSERT INTO chat_messages (model, role, content) VALUES (?, ?, ?)", (model, user_msg['role'], user_msg['content']))
            conn.commit()
            conn.close()
        except Exception as db_e:
            print(f"Database error in chat: {db_e}")

        def generate():
            # Immediate heartbeat to prevent 504 Gateway Timeout
            yield f"data: {json.dumps({'status': 'AI Agent initializing...'})}\n\n"
            
            current_messages = messages.copy()
            if not any(m.get('role') == 'system' for m in current_messages):
                current_messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})
                
            assistant_full_content = ""
            
            for turn in range(5):
                try:
                    # Pre-flight check
                    import socket
                    from urllib.parse import urlparse
                    parsed_url = urlparse(OLLAMA_API)
                    host = parsed_url.hostname or '127.0.0.1'
                    port = parsed_url.port or 11434
                    
                    # Heartbeat before potentially slow socket check
                    yield f"data: {json.dumps({'status': f'Checking connection to {host}...'})}\n\n"
                    
                    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                        s.settimeout(2.0)
                        if s.connect_ex((host, port)) != 0:
                            yield f"data: {json.dumps({'error': f'Cannot reach Ollama at {OLLAMA_API}'})}\n\n"
                            return

                    yield f"data: {json.dumps({'status': 'Ollama reached, waiting for response...'})}\n\n"
                    res = requests.post(f"{OLLAMA_API}/chat", json={
                        "model": model,
                        "messages": current_messages,
                        "tools": TOOLS_DEFINITION,
                        "stream": True 
                    }, stream=True, timeout=120)
                    
                    tool_calls = []
                    turn_assistant_message = {"role": "assistant", "content": ""}
                    
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
                            # CRITICAL: Keep connection alive during potentially slow tool execution
                            yield f"data: {json.dumps({'status': f'AI is executing {func_name}...'})}\n\n"
                            print(f"DEBUG: AI calling tool '{func_name}' with args: {args}")
                            
                            try:
                                # Extra heartbeat right before call
                                yield f"data: {json.dumps({'status': f'Waiting for {func_name} response...'})}\n\n"
                                
                                result = AVAILABLE_TOOLS[func_name](**args)
                                
                                print(f"DEBUG: Tool '{func_name}' returned result.")
                                yield f"data: {json.dumps({'status': f'Tool {func_name} execution finished.'})}\n\n"
                                
                                current_messages.append({"role": "tool", "content": str(result), "name": func_name})
                            except Exception as tool_e:
                                error_msg = f"Error executing tool {func_name}: {str(tool_e)}"
                                print(f"ERROR in tool '{func_name}': {error_msg}")
                                current_messages.append({"role": "tool", "content": error_msg, "name": func_name})
                                yield f"data: {json.dumps({'status': 'Tool failed, proceeding with error context...'})}\n\n"
                except Exception as e:
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
                    return

        return Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        print(f"CRITICAL ERROR in chat route: {e}")
        return jsonify({"error": str(e)}), 500

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
