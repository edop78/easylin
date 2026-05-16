import subprocess
import os
import psutil
import json
try:
    from backend.database import get_db
except ImportError:
    from database import get_db

def check_permission(capability):
    conn = get_db()
    cursor = conn.execute("SELECT enabled FROM ai_permissions WHERE capability = ?", (capability,))
    row = cursor.fetchone()
    conn.close()
    return row and row['enabled'] == 1

def tool_get_system_info():
    if not check_permission('system_info'):
        return "ERROR: Permission 'system_info' is disabled."
    return json.dumps({
        "cpu": psutil.cpu_percent(interval=0.1),
        "memory": psutil.virtual_memory()._asdict(),
        "disk": psutil.disk_usage('/')._asdict()
    })

def tool_list_containers():
    if not check_permission('docker_mgmt'):
        return "ERROR: Permission 'docker_mgmt' is disabled."
    try:
        result = subprocess.run(['curl', '--unix-socket', '/var/run/docker.sock', 'http://localhost/containers/json?all=1'], capture_output=True, text=True, timeout=10)
        return result.stdout
    except Exception as e:
        return f"ERROR: {str(e)}"

def tool_execute_command(command):
    if not check_permission('shell_exec'):
        return "ERROR: Permission 'shell_exec' is disabled. High-risk operation."
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30)
        return json.dumps({"stdout": result.stdout, "stderr": result.stderr, "exit_code": result.returncode})
    except Exception as e:
        return f"ERROR: {str(e)}"

def tool_read_file(path):
    if not check_permission('file_read'):
        return "ERROR: Permission 'file_read' is disabled."
    try:
        real_path = path if path.startswith('/host') else os.path.join('/host', path.lstrip('/'))
        with open(real_path, 'r', errors='replace') as f:
            return f.read(10000)
    except Exception as e:
        return f"ERROR: {str(e)}"

def tool_write_file(path, content):
    if not check_permission('file_write'):
        return "ERROR: Permission 'file_write' is disabled."
    try:
        real_path = path if path.startswith('/host') else os.path.join('/host', path.lstrip('/'))
        os.makedirs(os.path.dirname(real_path), exist_ok=True)
        with open(real_path, 'w') as f:
            f.write(content)
        return "SUCCESS: File written successfully."
    except Exception as e:
        return f"ERROR: {str(e)}"

def tool_manage_service(service, action):
    if not check_permission('service_mgmt'):
        return "ERROR: Permission 'service_mgmt' is disabled."
    if action not in ['start', 'stop', 'restart', 'status']:
        return "ERROR: Invalid action."
    try:
        result = subprocess.run(['systemctl', action, service], capture_output=True, text=True, timeout=15)
        return f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
    except Exception as e:
        return f"ERROR: {str(e)}"

def tool_manage_package(package, action):
    if not check_permission('package_mgmt'):
        return "ERROR: Permission 'package_mgmt' is disabled."
    if action not in ['install', 'remove']:
        return "ERROR: Invalid action."
    try:
        cmd = ['apt-get', 'install', '-y', package] if action == 'install' else ['apt-get', 'remove', '-y', package]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        return f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
    except Exception as e:
        return f"ERROR: {str(e)}"

def tool_list_processes():
    if not check_permission('process_mgmt'):
        return "ERROR: Permission 'process_mgmt' is disabled."
    procs = []
    for p in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 'memory_percent']):
        procs.append(p.info)
    return json.dumps(procs[:100]) # Limit to top 100

def tool_manage_container(container_id, action):
    if not check_permission('docker_mgmt'):
        return "ERROR: Permission 'docker_mgmt' is disabled."
    if action not in ['start', 'stop', 'restart', 'remove']:
        return "ERROR: Invalid action."
    try:
        # Use curl to Docker socket and capture HTTP status code
        method = "POST"
        url = f"http://localhost/containers/{container_id}/{action}"
        if action == "remove":
            method = "DELETE"
            url = f"http://localhost/containers/{container_id}?force=true"
        
        # We capture the HTTP status code to be sure
        cmd = ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-X', method, '--unix-socket', '/var/run/docker.sock', url]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        
        status_code = result.stdout.strip()
        
        # 204 is Success for stop/start/restart, 201 for start sometimes, 200 for remove
        if status_code in ['200', '201', '204']:
            return f"SUCCESS: Container {container_id} {action}ed (HTTP {status_code})"
        elif status_code == '404':
            return f"ERROR: Container '{container_id}' not found."
        elif status_code == '304':
            return f"INFO: Container '{container_id}' was already in the desired state ({action})."
        else:
            return f"FAILED: Docker returned HTTP {status_code}. Possible permission or state issue."
            
    except Exception as e:
        return f"ERROR: {str(e)}"

AVAILABLE_TOOLS = {
    "get_system_info": tool_get_system_info,
    "list_containers": tool_list_containers,
    "manage_container": tool_manage_container,
    "execute_command": tool_execute_command,
    "read_file": tool_read_file,
    "write_file": tool_write_file,
    "manage_service": tool_manage_service,
    "manage_package": tool_manage_package,
    "list_processes": tool_list_processes
}

TOOLS_DEFINITION = [
    {"type": "function", "function": {"name": "get_system_info", "description": "Get CPU, RAM and Disk metrics.", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "list_containers", "description": "List all Docker containers.", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "manage_container", "description": "Start, stop, restart or remove a Docker container using its ID or NAME.", "parameters": {"type": "object", "properties": {"container_id": {"type": "string", "description": "The ID or NAME of the container"}, "action": {"type": "string", "enum": ["start", "stop", "restart", "remove"]}}, "required": ["container_id", "action"]}}},
    {"type": "function", "function": {"name": "execute_command", "description": "Run shell commands.", "parameters": {"type": "object", "properties": {"command": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "read_file", "description": "Read file content.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "write_file", "description": "Write/Modify file content.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "manage_service", "description": "Manage system services (start, stop, restart, status).", "parameters": {"type": "object", "properties": {"service": {"type": "string"}, "action": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "manage_package", "description": "Install or remove packages via APT.", "parameters": {"type": "object", "properties": {"package": {"type": "string"}, "action": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "list_processes", "description": "List active system processes.", "parameters": {"type": "object", "properties": {}}}}
]
