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
6. SYSTEM STATS: If asked about CPU, RAM, disk or system metrics, YOU MUST call 'get_system_info' tool first. NEVER guess or make up numbers.
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

        # Database storage disabled: relying entirely on ephemeral frontend memory cache

        # Intelligent context reduction for small VM CPUs: 
        # Skip heavy tool definitions if user is just greeting or chatting simply.
        user_query = messages[-1].get("content", "").lower().strip()
        
        # Intelligent dynamic tool selection based on query keywords to drastically cut CPU prefill time
        active_tools = []
        
        if any(kw in user_query for kw in ["cpu", "ram", "disk", "stato", "risorse", "hardware", "info"]):
            active_tools.append(TOOLS_DEFINITION[0]) # get_system_info
            
        if any(kw in user_query for kw in ["docker", "container", "run", "start", "stop", "restart", "remove"]):
            active_tools.append(TOOLS_DEFINITION[1]) # list_containers
            active_tools.append(TOOLS_DEFINITION[2]) # manage_container
            
        if any(kw in user_query for kw in ["terminal", "shell", "command", "bash", "sh", "exec"]):
            active_tools.append(TOOLS_DEFINITION[3]) # execute_command
            
        if any(kw in user_query for kw in ["file", "folder", "directory", "read", "cat"]):
            active_tools.append(TOOLS_DEFINITION[4]) # read_file
            
        if any(kw in user_query for kw in ["write", "create", "modify", "save", "edit"]):
            active_tools.append(TOOLS_DEFINITION[5]) # write_file
            
        if any(kw in user_query for kw in ["service", "systemctl", "systemd", "nginx", "ufw"]):
            active_tools.append(TOOLS_DEFINITION[6]) # manage_service
            
        if any(kw in user_query for kw in ["package", "install", "uninstall", "apt", "apt-get"]):
            active_tools.append(TOOLS_DEFINITION[7]) # manage_package
            
        if any(kw in user_query for kw in ["process", "ps", "top", "kill", "processes"]):
            active_tools.append(TOOLS_DEFINITION[8]) # list_processes

        should_send_tools = len(active_tools) > 0
        
        # Allow small models (like 1.5B/3B) to be fast by default, and only invoke tools on explicit request
        print(f"DEBUG: User query: '{user_query}' | should_send_tools: {should_send_tools} | active_tools_count: {len(active_tools)}")

        def generate():
            # Immediate heartbeat to prevent 504 Gateway Timeout
            yield f"data: {json.dumps({'status': 'AI Agent initializing...'})}\n\n"
            
            # Sliding memory window: send only the last 5 messages to Ollama to keep CPU context small
            sliding_window_size = 5
            if len(messages) > sliding_window_size:
                current_messages = messages[-sliding_window_size:]
            else:
                current_messages = messages.copy()
                
            if not any(m.get('role') == 'system' for m in current_messages):
                if should_send_tools:
                    current_messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})
                else:
                    current_messages.insert(0, {"role": "system", "content": "You are the EasyLin AI Assistant, a helpful Linux server companion. Answer general questions in a friendly, conversational way, keeping responses brief."})
                
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
                    import time
                    start_time = time.time()
                    
                    payload = {
                        "model": model,
                        "messages": current_messages,
                        "stream": not should_send_tools # Disable streaming when tools are active to get perfect structured tool calls
                    }
                    if should_send_tools:
                        payload["tools"] = active_tools
                        
                    res = requests.post(f"{OLLAMA_API}/chat", json=payload, stream=True, timeout=120)
                    
                    tool_calls = []
                    turn_assistant_message = {"role": "assistant", "content": ""}
                    
                    # Optimized stream reading
                    last_heartbeat = time.time()
                    for line in res.iter_lines(decode_unicode=True):
                        if line:
                            try:
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
                            except Exception as json_e:
                                print(f"DEBUG: JSON parse error in stream: {json_e}")
                                continue
                        else:
                            # Periodic heartbeat every 2 seconds if no data
                            if time.time() - last_heartbeat > 2.0:
                                yield f"data: {json.dumps({'status': 'Thinking...'})}\n\n"
                                last_heartbeat = time.time()
                            yield ": heartbeat\n\n"
                    
                    print(f"DEBUG: Ollama thinking time: {time.time() - start_time:.2f}s")
                    if not tool_calls:
                        # Database storage disabled: relying entirely on ephemeral frontend memory cache
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
    # Database history reading disabled: relying entirely on ephemeral frontend memory cache
    return jsonify({"messages": []})

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
