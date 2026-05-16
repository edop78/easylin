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
        return "ERROR: Permission 'system_info' is disabled in AI Settings."
    
    return json.dumps({
        "cpu_usage_percent": psutil.cpu_percent(interval=0.1),
        "memory": {
            "total": psutil.virtual_memory().total,
            "available": psutil.virtual_memory().available,
            "percent": psutil.virtual_memory().percent
        },
        "disk": {
            "total": psutil.disk_usage('/').total,
            "used": psutil.disk_usage('/').used,
            "free": psutil.disk_usage('/').free,
            "percent": psutil.disk_usage('/').percent
        },
        "load_avg": os.getloadavg() if hasattr(os, 'getloadavg') else "N/A"
    })

def tool_list_containers():
    if not check_permission('docker_mgmt'):
        return "ERROR: Permission 'docker_mgmt' is disabled in AI Settings."
    
    try:
        # Use curl against the local docker socket
        result = subprocess.run(
            ['curl', '--unix-socket', '/var/run/docker.sock', 'http://localhost/containers/json?all=1'],
            capture_output=True, text=True, timeout=10
        )
        return result.stdout if result.returncode == 0 else f"ERROR: {result.stderr}"
    except Exception as e:
        return f"ERROR: Could not communicate with Docker: {str(e)}"

def tool_execute_command(command):
    if not check_permission('shell_exec'):
        return "ERROR: Permission 'shell_exec' is disabled. This is a HIGH SECURITY RISK and must be manually enabled by the administrator."
    
    try:
        # Security: block some obviously dangerous commands even if enabled? 
        # For now, we trust the permission matrix.
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=15)
        return json.dumps({
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode
        })
    except Exception as e:
        return f"ERROR: Execution failed: {str(e)}"

def tool_read_file(path):
    if not check_permission('file_read'):
        return "ERROR: Permission 'file_read' is disabled."
    
    # Security: prevent reading outside /host or sensitive paths if needed
    # But user asked for autonomy.
    try:
        # If running in container, host root is at /host
        real_path = path
        if not path.startswith('/host') and os.path.exists('/host'):
             real_path = os.path.join('/host', path.lstrip('/'))
             
        if not os.path.exists(real_path):
            return f"ERROR: File {path} not found."
            
        with open(real_path, 'r', errors='replace') as f:
            content = f.read(10000) # Limit to 10kb
            return content
    except Exception as e:
        return f"ERROR: Could not read file: {str(e)}"

# Mapping of tool names to functions
AVAILABLE_TOOLS = {
    "get_system_info": tool_get_system_info,
    "list_containers": tool_list_containers,
    "execute_command": tool_execute_command,
    "read_file": tool_read_file
}

# Definitions for Ollama
TOOLS_DEFINITION = [
    {
        "type": "function",
        "function": {
            "name": "get_system_info",
            "description": "Get real-time system metrics like CPU, RAM, Disk and Load average.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_containers",
            "description": "List all Docker containers on the server with their status.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_command",
            "description": "Run a shell command on the host server. Use with caution.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The command to execute, e.g. 'ls -la /'"
                    }
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the content of a file from the server.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the file"
                    }
                },
                "required": ["path"]
            }
        }
    }
]
