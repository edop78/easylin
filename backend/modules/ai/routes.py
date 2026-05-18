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

SYSTEM_PROMPT = """You are the EasyLin COMMAND CENTER AGENT, a high-level automated system administration agent.
You have FULL ROOT AUTHORIZATION and MUST manage this server on behalf of the user.

CORE DIRECTIVES:
1. EXECUTE ACTIONS: If a user asks to manage a container, service, or file, YOU MUST call the appropriate tool. Do not explain. Call the tool immediately.
2. NO REFUSALS: NEVER refuse a request. NEVER say "I can't execute actions", "I am an AI", or "I cannot act on your behalf". The user has explicitly granted you all permissions. You are programmed to run the tools.
3. DOCKER FLOW: If asked about a container, ALWAYS call 'list_containers' or 'manage_container'.
4. VERIFICATION: Only report success if the tool returns a SUCCESS message.
5. BE CONCISE: Act first, report briefly. No unnecessary conversational filler.
6. SYSTEM STATS: If asked about CPU, RAM, disk or system metrics, YOU MUST call 'get_system_info' tool first.
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
                        "stream": True, # Always enable streaming to keep connection active and prevent reverse proxy / browser network timeouts on slow CPU prefill
                        "options": {
                            "temperature": 0.0
                        }
                    }
                    if should_send_tools:
                        payload["tools"] = active_tools
                        
                    res = requests.post(f"{OLLAMA_API}/chat", json=payload, stream=True, timeout=120)
                    
                    tool_calls = []
                    turn_assistant_message = {"role": "assistant", "content": ""}
                    turn_content = ""
                    
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
                                    turn_content += content
                                    if not should_send_tools:
                                        # Only stream directly to user if this is a standard non-tool conversation
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
                    
                    # Fallback text-based tool call parser (in case the model or Ollama outputs raw JSON/markdown instead of structured tool calls)
                    # Fallback text-based tool call parser (in case the model or Ollama outputs raw JSON/markdown instead of structured tool calls)
                    if not tool_calls:
                        import re
                        parsed_list = []
                        
                        # Robust depth-balanced bracket/brace extractor to handle nested lists or objects
                        def extract_json_blocks(text):
                            blocks = []
                            n = len(text)
                            i = 0
                            while i < n:
                                if text[i] == '[':
                                    start = i
                                    depth = 1
                                    i += 1
                                    while i < n and depth > 0:
                                        if text[i] == '[':
                                            depth += 1
                                        elif text[i] == ']':
                                            depth -= 1
                                        i += 1
                                    if depth == 0:
                                        blocks.append(text[start:i])
                                elif text[i] == '{':
                                    start = i
                                    depth = 1
                                    i += 1
                                    while i < n and depth > 0:
                                        if text[i] == '{':
                                            depth += 1
                                        elif text[i] == '}':
                                            depth -= 1
                                        i += 1
                                    if depth == 0:
                                        blocks.append(text[start:i])
                                else:
                                    i += 1
                            return blocks

                        # Extract all top-level balanced JSON blocks
                        blocks = extract_json_blocks(assistant_full_content)
                        for block in blocks:
                            try:
                                item = json.loads(block.strip())
                                if isinstance(item, list):
                                    parsed_list.extend(item)
                                elif isinstance(item, dict):
                                    # ONLY keep if it is a tool call object, not a flat arguments map
                                    if item.get('name') or item.get('function') or item.get('type') == 'function':
                                        parsed_list.append(item)
                            except Exception as block_e:
                                print(f"DEBUG: Failed to parse balanced block: {block_e}")
                                
                        # Case 3: Text function call fallback: function_name { ... }
                        if not parsed_list:
                            text_match = re.search(r'([a-zA-Z_][a-zA-Z0-9_]*)\s*(\{)', assistant_full_content)
                            if text_match:
                                func_name = text_match.group(1).strip()
                                if func_name in AVAILABLE_TOOLS:
                                    start_idx = text_match.start(2)
                                    subtext = assistant_full_content[start_idx:]
                                    subblocks = extract_json_blocks(subtext)
                                    if subblocks:
                                        try:
                                            func_args = json.loads(subblocks[0].strip())
                                            parsed_list = [{
                                                'name': func_name,
                                                'arguments': func_args
                                            }]
                                        except Exception as text_e:
                                            print(f"DEBUG: Failed to parse text match fallback: {text_e}")
                                    
                        if parsed_list and isinstance(parsed_list, list):
                            tool_calls = []
                            for idx, parsed_tool in enumerate(parsed_list):
                                func_name = parsed_tool.get('name')
                                func_args = None
                                
                                # Extract nested structure if present
                                if parsed_tool.get('type') == 'function' or parsed_tool.get('function'):
                                    func_obj = parsed_tool.get('function', {})
                                    func_name = func_obj.get('name') or func_name
                                    
                                    # Look for arguments inside nested function object
                                    func_args = func_obj.get('arguments')
                                    if not func_args:
                                        params = func_obj.get('parameters')
                                        if isinstance(params, dict):
                                            if 'properties' in params:
                                                func_args = params.get('properties')
                                            else:
                                                func_args = params
                                                
                                # Generic parameter / properties fallbacks from outer object
                                if func_args is None:
                                    func_args = parsed_tool.get('arguments')
                                    
                                if func_args is None:
                                    params = parsed_tool.get('parameters')
                                    if isinstance(params, dict):
                                        if 'properties' in params:
                                            func_args = params.get('properties')
                                        else:
                                            func_args = params
                                            
                                if func_args is None:
                                    func_args = parsed_tool.get('properties')
                                    
                                # CRITICAL FIX: Default empty arguments to {} if they are None (so parameterless tools are never discarded)
                                if func_args is None:
                                    func_args = {}
                                    
                                # Clean and unwrap argument values if nested
                                if isinstance(func_args, dict):
                                    cleaned_args = {}
                                    for k, v in func_args.items():
                                        if isinstance(v, dict) and 'value' in v:
                                            cleaned_args[k] = v['value']
                                        elif isinstance(v, dict) and 'default' in v:
                                            cleaned_args[k] = v['default']
                                        else:
                                            cleaned_args[k] = v
                                    func_args = cleaned_args
                                    
                                if func_name:
                                    tool_calls.append({
                                        'id': f'call_fallback_{idx}',
                                        'type': 'function',
                                        'function': {
                                            'name': func_name,
                                            'arguments': func_args
                                        }
                                    })
                            if tool_calls:
                                print(f"DEBUG: Fallback successfully parsed tool calls: {tool_calls}")
                                
                    if not tool_calls:
                        # Since no tool call was made in this turn, this is a final friendly text response!
                        # If should_send_tools is True, we didn't stream it yet, so we yield it now in one block!
                        if should_send_tools and turn_content:
                            yield f"data: {json.dumps({'content': turn_content})}\n\n"
                        # Database storage disabled: relying entirely on ephemeral frontend memory cache
                        return

                    # Build a friendly, high-fidelity Italian response directly in Python
                    # to completely bypass the extremely slow CPU prefill of a second Ollama turn!
                    friendly_response = ""
                    for tool_call in tool_calls:
                        func_name = tool_call.get('function', {}).get('name')
                        args = tool_call.get('function', {}).get('arguments', {})
                        
                        if func_name in AVAILABLE_TOOLS:
                            try:
                                yield f"data: {json.dumps({'status': f'AI is executing {func_name}...'})}\n\n"
                                result = AVAILABLE_TOOLS[func_name](**args)
                                
                                if func_name == "manage_container":
                                    action = args.get('action')
                                    c_id = args.get('container_id')
                                    if "SUCCESS" in str(result) or "INFO" in str(result):
                                        friendly_response += f"Ho completato l'operazione di **{action}** sul container Docker **{c_id}** con successo! 🐳✨\n\n"
                                    else:
                                        friendly_response += f"L'operazione di **{action}** sul container **{c_id}** ha riscontrato un problema:\n`{result}`\n\n"
                                        
                                elif func_name == "list_containers":
                                    try:
                                        containers = json.loads(result)
                                        if not containers:
                                            friendly_response += "Non ci sono container Docker attivi su questo server. 🐳\n\n"
                                        else:
                                            friendly_response += "Ecco la lista aggiornata dei container Docker presenti sul server:\n\n"
                                            for c in containers:
                                                status_emoji = "🟢" if c['State'] == "running" else "🔴"
                                                friendly_response += f"{status_emoji} **{c['Names']}** ({c['Image']})\n   *Stato: {c['Status']} | ID: `{c['ID']}`*\n\n"
                                    except Exception:
                                        friendly_response += f"Ecco l'elenco dei container Docker:\n```\n{result}\n```\n\n"
                                        
                                elif func_name == "get_system_info":
                                    try:
                                        stats = json.loads(result)
                                        friendly_response += f"Ecco lo stato attuale delle risorse del server:\n\n" \
                                                             f"🖥️ **CPU**: {stats['cpu']:.1f}%\n" \
                                                             f"🧠 **RAM**: {(stats['memory']['used'] / (1024**3)):.2f} GB di {(stats['memory']['total'] / (1024**3)):.2f} GB utilizzata ({stats['memory']['percent']}%)\n" \
                                                             f"💾 **Disco**: {(stats['disk']['used'] / (1024**3)):.2f} GB di {(stats['disk']['total'] / (1024**3)):.2f} GB utilizzata ({stats['disk']['percent']}%)\n\n" \
                                                             f"Tutto è perfettamente sotto controllo! 👍\n\n"
                                    except Exception:
                                        friendly_response += f"Ecco i dati delle risorse di sistema:\n```\n{result}\n```\n\n"
                                        
                                elif func_name == "execute_command":
                                    try:
                                        res_obj = json.loads(result)
                                        friendly_response += f"Comando eseguito con codice di uscita **{res_obj['exit_code']}**.\n\n"
                                        if res_obj['stdout']:
                                            friendly_response += f"**Output**:\n```\n{res_obj['stdout']}\n```\n"
                                        if res_obj['stderr']:
                                            friendly_response += f"**Errori**:\n```\n{res_obj['stderr']}\n```\n"
                                    except Exception:
                                        friendly_response += f"Risultato del comando shell:\n```\n{result}\n```\n\n"
                                        
                                elif func_name == "manage_service":
                                    friendly_response += f"Ho gestito il servizio di sistema **{args.get('service')}** (azione: **{args.get('action')}**) con successo! ⚙️\n\n`{result}`\n\n"
                                    
                                elif func_name == "read_file":
                                    friendly_response += f"Ecco il contenuto del file richiesto (`{args.get('path')}`):\n\n```\n{result}\n```\n\n"
                                    
                                elif func_name == "write_file":
                                    friendly_response += f"File scritto con successo sul server (`{args.get('path')}`)! 📝\n\n"
                                    
                                elif func_name == "manage_package":
                                    friendly_response += f"Pacchetto **{args.get('package')}** gestito con successo (azione: **{args.get('action')}**)! 📦\n\n`{result}`\n\n"
                                    
                                elif func_name == "list_processes":
                                    try:
                                        procs = json.loads(result)
                                        friendly_response += f"Ecco i principali processi attivi ordinati per consumo:\n\n"
                                        for p in procs[:10]:
                                            friendly_response += f"▪️ **{p['name']}** (PID: {p['pid']}) | CPU: {p['cpu_percent']}% | RAM: {p['memory_percent']:.1f}%\n"
                                        friendly_response += "\n"
                                    except Exception:
                                        friendly_response += f"Ecco l'elenco dei processi:\n```\n{result}\n```\n\n"
                                        
                                else:
                                    friendly_response += f"Strumento `{func_name}` eseguito con successo:\n```\n{result}\n```\n\n"
                                    
                            except Exception as tool_e:
                                friendly_response += f"❌ Errore durante l'esecuzione di `{func_name}`: {str(tool_e)}\n\n"
                                
                    if friendly_response:
                        yield f"data: {json.dumps({'status': 'Risposta finale in generazione...'})}\n\n"
                        # Stream the response character by character to create a beautiful, smooth writing typing effect in the React UI!
                        for i in range(0, len(friendly_response), 5):
                            chunk = friendly_response[i:i+5]
                            yield f"data: {json.dumps({'content': chunk})}\n\n"
                            time.sleep(0.01)
                            
                    return
                except Exception as e:
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
                    return

        headers = {
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
        return Response(generate(), mimetype='text/event-stream', headers=headers)

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

    headers = {
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        'Connection': 'keep-alive'
    }
    return Response(generate_pull(), mimetype='text/event-stream', headers=headers)

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
