import shlex
import docker
import os
import time
from .tasks import update_task_db

MARKET_APPS = [
    {
        "id": "nginx-proxy-manager",
        "containerName": "nginx-proxy-manager"
    },
    {
        "id": "ollama",
        "containerName": "ollama"
    }
]

def get_client():
    """Get Docker client."""
    try:
        return docker.from_env()
    except:
        return None

def parse_docker_run(command_str):
    cmd = command_str.strip()
    if cmd.startswith("docker "):
        cmd = cmd[7:].strip()
    if cmd.startswith("run "):
        cmd = cmd[4:].strip()
    elif cmd.startswith("pull "):
        cmd = cmd[5:].strip()
    elif cmd.startswith("create "):
        cmd = cmd[7:].strip()
        
    try:
        args = shlex.split(cmd)
    except Exception as e:
        raise ValueError(f"Error parsing command line syntax: {str(e)}")
        
    options = {
        "image": None,
        "name": None,
        "ports": {},
        "volumes": {},
        "environment": {},
        "restart_policy": {"Name": "unless-stopped"},
        "network_mode": None,
        "privileged": False,
        "command": [],
        "detach": True
    }
    
    i = 0
    while i < len(args):
        arg = args[i]
        
        if arg.startswith("-"):
            if arg in ["-d", "--detach"]:
                options["detach"] = True
                i += 1
            elif arg == "--privileged":
                options["privileged"] = True
                i += 1
            elif arg in ["-p", "--publish"]:
                if i + 1 < len(args):
                    val = args[i+1]
                    if ":" in val:
                        parts = val.split(":")
                        host_port = parts[0]
                        container_port = parts[1]
                        if "/" not in container_port:
                            container_port = f"{container_port}/tcp"
                        try:
                            if len(parts) == 3:
                                ip, hport, cport = parts
                                if "/" not in cport:
                                    cport = f"{cport}/tcp"
                                options["ports"][cport] = (ip, int(hport))
                            else:
                                options["ports"][container_port] = int(host_port)
                        except ValueError:
                            pass
                    i += 2
                else:
                    i += 1
            elif arg in ["-v", "--volume"]:
                if i + 1 < len(args):
                    val = args[i+1]
                    if ":" in val:
                        parts = val.split(":")
                        host_path = parts[0]
                        container_path = parts[1]
                        mode = parts[2] if len(parts) == 3 else "rw"
                        options["volumes"][host_path] = {"bind": container_path, "mode": mode}
                    i += 2
                else:
                    i += 1
            elif arg in ["-e", "--env"]:
                if i + 1 < len(args):
                    val = args[i+1]
                    if "=" in val:
                        parts = val.split("=", 1)
                        options["environment"][parts[0]] = parts[1]
                    i += 2
                else:
                    i += 1
            elif arg == "--restart":
                if i + 1 < len(args):
                    val = args[i+1]
                    options["restart_policy"] = {"Name": val}
                    i += 2
                else:
                    i += 1
            elif arg == "--network":
                if i + 1 < len(args):
                    options["network_mode"] = args[i+1]
                    i += 2
                else:
                    i += 1
            elif arg == "--name":
                if i + 1 < len(args):
                    options["name"] = args[i+1]
                    i += 2
                else:
                    i += 1
            else:
                i += 1
        else:
            if not options["image"]:
                options["image"] = arg
            else:
                options["command"].append(arg)
            i += 1
            
    if not options["image"]:
        raise ValueError("No image name found in the docker command.")
        
    return options

def background_install(app_id, app_config, flask_app):
    def log_msg(msg):
        update_task_db(app_id, log_entry=msg)

    with flask_app.app_context():
        try:
            log_msg("Initializing Docker client...")
            client = docker.from_env()
            # Check if already exists
            try:
                client.containers.get(app_config["name"])
                update_task_db(app_id, status="success", message="Already installed")
                log_msg("Container already exists. Task finished.")
                return
            except Exception:
                pass

            # Pull with progress tracking
            log_msg(f"Starting pull for {app_config['image']}...")
            last_logged_status = {}
            
            for line in client.api.pull(app_config["image"], stream=True, decode=True):
                if "error" in line:
                    error_detail = line.get("errorDetail", {}).get("message", line["error"])
                    raise Exception(f"Pull failed: {error_detail}")
                
                status = line.get("status", "")
                layer_id = line.get("id", "no-id")
                
                # Filter out redundant lines
                if status not in ["Downloading", "Extracting"] or last_logged_status.get(layer_id) != status:
                    prefix = f"[{layer_id}] " if layer_id != "no-id" else ""
                    log_msg(f"{prefix}{status}")
                    last_logged_status[layer_id] = status

            # Verify image exists before running
            log_msg("Verifying image...")
            try:
                client.images.get(app_config["image"])
            except Exception:
                log_msg(f"Image {app_config['image']} not found after pull. Retrying high-level pull...")
                client.images.pull(app_config["image"])

            # Run
            log_msg("Creating container...")
            run_kwargs = {
                "image": app_config["image"],
                "name": app_config["name"],
                "volumes": app_config.get("volumes", {}),
                "restart_policy": app_config.get("restart_policy", {"Name": "unless-stopped"}),
                "detach": True
            }
            
            if app_config.get("network_mode"):
                run_kwargs["network_mode"] = app_config["network_mode"]
            
            if app_config.get("ports") and not app_config.get("network_mode") == "host":
                run_kwargs["ports"] = app_config["ports"]
            
            if app_config.get("environment"):
                run_kwargs["environment"] = app_config["environment"]

            client.containers.run(**run_kwargs)
            update_task_db(app_id, status="success", message="Installed successfully")
            log_msg("Installation completed successfully.")
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            error_msg = str(e)
            if "port is already allocated" in error_msg.lower():
                error_msg = "Port conflict: Port 11434 is already in use."
            
            log_msg(f"ERROR: {error_msg}")
            log_msg(error_details)
            update_task_db(app_id, status="error", message="Failed", error=error_msg)
