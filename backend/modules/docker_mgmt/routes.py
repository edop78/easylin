"""Docker management API — containers, images, volumes, networks."""

import docker
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
import os
import threading

import json
import time
from database import get_db

docker_bp = Blueprint("docker", __name__)

# Fail-safe file logging for terminal output
LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "install_log.txt")

def update_task_db(app_id, status=None, message=None, error=None, log_entry=None, logs_list=None):
    """Update task status in DB and write to physical log file."""
    if log_entry:
        try:
            with open(LOG_FILE, "a") as f:
                f.write(f"{log_entry}\n")
        except:
            pass
            
    conn = get_db()
    try:
        # Get current
        cur = conn.cursor()
        cur.execute("SELECT status, message, error, logs FROM task_status WHERE app_id = ?", (app_id,))
        row = cur.fetchone()
        
        current_logs = []
        if row and row['logs']:
            current_logs = json.loads(row['logs'])
        
        if logs_list is not None:
            current_logs = logs_list
        elif log_entry:
            # Aggressive de-duplication: if identical to last line, ignore
            if current_logs and log_entry == current_logs[-1]:
                return

            # Layer-aware progress update
            is_progress = log_entry.startswith('[') and ']' in log_entry
            if is_progress:
                layer_tag = log_entry.split(']')[0] + ']'
                if current_logs and current_logs[-1].startswith(layer_tag):
                    current_logs[-1] = log_entry
                else:
                    current_logs.append(log_entry)
            else:
                # If it's a generic message (like "Extracting") and the last one was also generic and same
                if current_logs and log_entry == current_logs[-1]:
                    return
                current_logs.append(log_entry)
            
            if len(current_logs) > 100: # Limit to 100 lines for even more speed
                current_logs.pop(0)
        
        new_status = status or (row['status'] if row else 'installing')
        new_message = message or (row['message'] if row else '')
        new_error = error or (row['error'] if row else None)
        
        conn.execute("""
            INSERT INTO task_status (app_id, status, message, error, logs, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(app_id) DO UPDATE SET
                status = excluded.status,
                message = excluded.message,
                error = excluded.error,
                logs = excluded.logs,
                updated_at = CURRENT_TIMESTAMP
        """, (app_id, new_status, new_message, new_error, json.dumps(current_logs)))
        conn.commit()
    finally:
        conn.close()

def get_tasks_db():
    """Get all tasks from DB."""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT app_id, status, message, error, logs FROM task_status")
        rows = cur.fetchall()
        tasks = {}
        for r in rows:
            tasks[r['app_id']] = {
                "status": r['status'],
                "message": r['message'],
                "error": r['error'],
                "logs": json.loads(r['logs']) if r['logs'] else []
            }
        return tasks
    finally:
        conn.close()


def get_client():
    """Get Docker client."""
    try:
        return docker.from_env()
    except Exception as e:
        return None


@docker_bp.route("/info", methods=["GET"])
@jwt_required()
def docker_info():
    """Get Docker daemon info."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    try:
        info = client.info()
        return jsonify({
            "version": info.get("ServerVersion", ""),
            "containers": info.get("Containers", 0),
            "running": info.get("ContainersRunning", 0),
            "paused": info.get("ContainersPaused", 0),
            "stopped": info.get("ContainersStopped", 0),
            "images": info.get("Images", 0),
            "driver": info.get("Driver", ""),
            "memory": info.get("MemTotal", 0),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/containers", methods=["GET"])
@jwt_required()
def list_containers():
    """List all containers."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    try:
        containers = client.containers.list(all=True)
        result = []
        for c in containers:
            result.append({
                "id": c.short_id,
                "name": c.name,
                "image": str(c.image.tags[0]) if c.image.tags else str(c.image.short_id),
                "image_id": c.image.id,
                "status": c.status,
                "state": c.attrs["State"]["Status"],
                "ports": c.ports,
                "created": c.attrs["Created"],
            })
        return jsonify({"containers": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/containers/<container_id>/<action>", methods=["POST"])
@jwt_required()
def container_action(container_id, action):
    """Start, stop, restart, or remove a container."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    allowed = ["start", "stop", "restart", "remove"]
    if action not in allowed:
        return jsonify({"error": f"Invalid action. Allowed: {allowed}"}), 400

    try:
        container = client.containers.get(container_id)
        if action == "remove":
            # Safety check: don't remove running container without force
            if container.status == "running":
                return jsonify({"error": "Cannot remove a running container. Stop it first."}), 400
            container.remove()
        else:
            getattr(container, action)()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/containers/run", methods=["POST"])
@jwt_required()
def run_container():
    """Run a custom container manually or from GitHub."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    data = request.get_json()
    install_type = data.get("type", "image")
    image_or_repo = data.get("image")
    name = data.get("name")
    ports_raw = data.get("ports", "")
    
    if not image_or_repo:
        return jsonify({"error": "Image name or Repository URL is required"}), 400

    ports_dict = {}
    if ports_raw:
        try:
            for p in ports_raw.split(","):
                host_port, container_port = p.strip().split(":")
                ports_dict[f"{container_port}/tcp"] = int(host_port)
        except Exception:
            return jsonify({"error": "Invalid ports format. Use host:container"}), 400

    try:
        final_image = image_or_repo
        if install_type == "github":
            tag = name if name else "custom-app-build"
            client.images.build(path=image_or_repo, tag=tag, rm=True)
            final_image = tag
        elif install_type == "image":
            client.images.pull(image_or_repo)

        container = client.containers.run(
            final_image,
            name=name if name else None,
            ports=ports_dict,
            detach=True,
            restart_policy={"Name": "unless-stopped"}
        )
        return jsonify({
            "success": True, 
            "container_id": container.short_id,
            "message": f"Container {container.name} started successfully"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/images", methods=["GET"])
@jwt_required()
def list_images():
    """List Docker images and check if they are in use."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    try:
        images = client.images.list()
        containers = client.containers.list(all=True)
        used_image_ids = {c.image.id for c in containers}
        
        result = []
        for img in images:
            result.append({
                "id": img.short_id,
                "full_id": img.id,
                "tags": img.tags,
                "size": img.attrs.get("Size", 0),
                "in_use": img.id in used_image_ids
            })
        return jsonify({"images": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/volumes", methods=["GET"])
@jwt_required()
def list_volumes():
    """List Docker volumes and check if they are in use."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    try:
        volumes = client.volumes.list()
        containers = client.containers.list(all=True)
        
        used_volumes = set()
        for c in containers:
            mounts = c.attrs.get("Mounts", [])
            for m in mounts:
                if m.get("Type") == "volume":
                    used_volumes.add(m.get("Name"))

        result = []
        for v in volumes:
            result.append({
                "name": v.name,
                "driver": v.attrs.get("Driver", ""),
                "mountpoint": v.attrs.get("Mountpoint", ""),
                "in_use": v.name in used_volumes
            })
        return jsonify({"volumes": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/volumes/<name>", methods=["DELETE"])
@jwt_required()
def remove_volume(name):
    """Remove a Docker volume."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    try:
        volume = client.volumes.get(name)
        volume.remove(force=True)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/containers/<container_id>/logs", methods=["GET"])
@jwt_required()
def container_logs(container_id):
    """Get container logs."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    try:
        container = client.containers.get(container_id)
        tail = request.args.get("tail", "100")
        logs = container.logs(tail=int(tail), timestamps=True).decode("utf-8", errors="replace")
        return jsonify({"logs": logs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/market/install", methods=["POST"])
@jwt_required()
def market_install():
    """Install a predefined app."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    data = request.get_json()
    app_id = data.get("app_id")

    apps = {
        "nginx-proxy-manager": {
            "name": "nginx-proxy-manager",
            "image": "jc21/nginx-proxy-manager:latest",
            "ports": {"80/tcp": 80, "81/tcp": 81, "443/tcp": 443},
            "volumes": {
                "npm_data": {"bind": "/data", "mode": "rw"},
                "npm_letsencrypt": {"bind": "/etc/letsencrypt", "mode": "rw"}
            },
            "restart_policy": {"Name": "unless-stopped"}
        },
        "ollama": {
            "name": "ollama",
            "image": "ollama/ollama:latest",
            "ports": {"11434/tcp": 11434},
            "environment": {
                "OLLAMA_HOST": "0.0.0.0",
                "OLLAMA_ORIGINS": "*"
            },
            "volumes": {
                "ollama_data": {"bind": "/root/.ollama", "mode": "rw"}
            },
            "restart_policy": {"Name": "unless-stopped"}
        }
    }

    app_config = apps.get(app_id)
    if not app_config:
        return jsonify({"error": "Unknown app"}), 400

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
                    
                    # Filter: Only log if status is NOT "Downloading" or "Extracting" 
                    # OR if it's the FIRST time we see this layer.
                    # This prevents 10,000 lines of progress.
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
                
                # Build run arguments dynamically
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

    try:
        # Check if already exists (immediate check) and cleanup if it's dead
        try:
            old_c = client.containers.get(app_config['name'])
            if old_c.status != 'running':
                log_msg(f"Removing old stopped container: {app_config['name']}")
                old_c.remove()
            else:
                return jsonify({"error": f"Container {app_config['name']} is already running"}), 409
        except Exception:
            pass

        # Initialize task status in DB
        update_task_db(app_id, status="installing", message="Initializing...", logs_list=[])

        # Start installation in background
        # Clear log file for new installation
        try:
            with open(LOG_FILE, "w") as f:
                f.write(f"--- Deployment Started: {app_config['name']} ---\n")
                f.write(f"--- Time: {time.ctime()} ---\n")
        except:
            pass

        # Create initial status BEFORE thread starts to avoid UI race condition
        update_task_db(app_id, status="installing", message="Starting installation...", log_entry=f"Initializing backend deployment thread...")
        
        thread = threading.Thread(
            target=background_install, 
            args=(app_id, app_config, current_app._get_current_object())
        )
        thread.daemon = True
        thread.start()

        return jsonify({
            "success": True, 
            "message": f"Installation of {app_config['name']} started in background. Check the App Store for progress."
        }), 202
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/market/status", methods=["GET"])
@jwt_required()
def market_status():
    """Get status of background installations with smart detection."""
    conn = get_db()
    try:
        # Cleanup stale tasks (older than 10 mins)
        conn.execute("DELETE FROM task_status WHERE status = 'installing' AND updated_at < datetime('now', '-10 minutes')")
        conn.commit()
        
        cursor = conn.execute("SELECT app_id, status, message, error, logs, updated_at FROM task_status")
        rows = cursor.fetchall()
        
        # Get actual containers to cross-reference
        existing_containers = []
        try:
            client = get_client()
            if client:
                existing_containers = [c.name for c in client.containers.list(all=True)]
        except:
            pass

        tasks = {}
        # First, collect all IDs from DB
        db_task_ids = set()
        for row in rows:
            app_id, status, message, error, logs_json, updated_at = row
            db_task_ids.add(app_id)
            
            # Smart detection
            container_name = app_id
            for app_cfg in MARKET_APPS:
                if app_cfg['id'] == app_id:
                    container_name = app_cfg['containerName']
                    break
            
            if status == 'installing' and container_name in existing_containers:
                status = 'installed'
                message = 'Completed (Detected)'

            mem_logs = GLOBAL_LOGS.get(app_id, [])
            tasks[app_id] = {
                "status": status,
                "message": message or "Initializing...",
                "error": error,
                "logs": mem_logs if mem_logs else (json.loads(logs_json) if logs_json else []),
                "updated_at": updated_at
            }

        # SECOND: Add tasks that are ONLY in RAM (just started)
        for app_id, mem_logs in GLOBAL_LOGS.items():
            if app_id not in tasks:
                tasks[app_id] = {
                    "status": "installing",
                    "message": "Initializing (RAM)...",
                    "error": None,
                    "logs": mem_logs,
                    "updated_at": None
                }
        
        return jsonify({"tasks": tasks})
    finally:
        conn.close()


@docker_bp.route("/debug/ollama", methods=["GET"])
@jwt_required()
def debug_ollama():
    """Internal debug route to inspect Ollama state."""
    client = get_client()
    if not client:
        return jsonify({"error": "No docker client"}), 500
    try:
        c = client.containers.get("ollama")
        return jsonify({
            "status": c.status,
            "network_mode": c.attrs['HostConfig']['NetworkMode'],
            "ip": c.attrs['NetworkSettings']['IPAddress'],
            "ports": c.attrs['NetworkSettings']['Ports'],
            "logs": c.logs(tail=30).decode('utf-8', errors='replace')
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/market/logs/file", methods=["GET"])
@jwt_required()
def get_market_logs_file():
    """Get real-time logs from the physical file."""
    if not os.path.exists(LOG_FILE):
        return jsonify({"logs": [
            "--- EasyLin Terminal System Ready ---",
            "--- Waiting for new deployment to start... ---"
        ]})
    
    try:
        with open(LOG_FILE, "r") as f:
            lines = f.readlines()
            return jsonify({"logs": [line.strip() for line in lines]})
    except Exception as e:
        return jsonify({"logs": [f"--- Error reading log file: {str(e)} ---"]})


@docker_bp.route("/market/clear/<app_id>", methods=["POST"])
@jwt_required()
def market_clear(app_id):
    """Clear a task status."""
    conn = get_db()
    try:
        conn.execute("DELETE FROM task_status WHERE app_id = ?", (app_id,))
        conn.commit()
        # Also clear in-memory logs
        if app_id in GLOBAL_LOGS:
            del GLOBAL_LOGS[app_id]
    finally:
        conn.close()
    return jsonify({"success": True})


@docker_bp.route("/images/<image_id>", methods=["DELETE"])
@jwt_required()
def remove_image(image_id):
    client = get_client()
    try:
        client.images.remove(image_id)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/networks", methods=["GET"])
@jwt_required()
def list_networks():
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503
    try:
        networks = client.networks.list()
        result = []
        for n in networks:
            result.append({
                "id": n.short_id,
                "name": n.name,
                "driver": n.attrs.get("Driver", ""),
                "scope": n.attrs.get("Scope", ""),
            })
        return jsonify({"networks": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def parse_docker_run(command_str):
    import shlex
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
            elif arg.startswith("-p="):
                val = arg[3:]
                if ":" in val:
                    parts = val.split(":")
                    host_port = parts[0]
                    container_port = parts[1]
                    if "/" not in container_port:
                        container_port = f"{container_port}/tcp"
                    try:
                        options["ports"][container_port] = int(host_port)
                    except ValueError:
                        pass
                i += 1
            elif arg in ["-v", "--volume"]:
                if i + 1 < len(args):
                    val = args[i+1]
                    if ":" in val:
                        parts = val.split(":")
                        host_path = parts[0]
                        container_path = parts[1]
                        mode = parts[2] if len(parts) > 2 else "rw"
                        options["volumes"][host_path] = {"bind": container_path, "mode": mode}
                    i += 2
                else:
                    i += 1
            elif arg in ["-e", "--env"]:
                if i + 1 < len(args):
                    val = args[i+1]
                    if "=" in val:
                        k, v = val.split("=", 1)
                        options["environment"][k] = v
                    i += 2
                else:
                    i += 1
            elif arg == "--name":
                if i + 1 < len(args):
                    options["name"] = args[i+1]
                    i += 2
                else:
                    i += 1
            elif arg.startswith("--name="):
                options["name"] = arg[7:]
                i += 1
            elif arg == "--restart":
                if i + 1 < len(args):
                    policy = args[i+1]
                    options["restart_policy"] = {"Name": policy}
                    i += 2
                else:
                    i += 1
            elif arg.startswith("--restart="):
                options["restart_policy"] = {"Name": arg[10:]}
                i += 1
            elif arg in ["--network", "--net"]:
                if i + 1 < len(args):
                    options["network_mode"] = args[i+1]
                    i += 2
                else:
                    i += 1
            elif arg.startswith("--network="):
                options["network_mode"] = arg[10:]
                i += 1
            elif arg.startswith("--net="):
                options["network_mode"] = arg[6:]
                i += 1
            else:
                i += 1
        else:
            options["image"] = arg
            options["command"] = args[i+1:]
            break
            
    if not options["image"]:
        raise ValueError("No Docker image found in command line string.")
        
    return options


@docker_bp.route("/containers/run-command", methods=["POST"])
@jwt_required()
def run_container_command():
    """Run a custom container from a single docker run command line."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    data = request.get_json()
    command_str = data.get("command")
    if not command_str:
        return jsonify({"error": "Command line is required"}), 400

    try:
        options = parse_docker_run(command_str)
        
        # 1. Pull the image
        client.images.pull(options["image"])
        
        # 2. Run the container
        container = client.containers.run(
            options["image"],
            command=options["command"] if options["command"] else None,
            name=options["name"],
            ports=options["ports"] if options["ports"] else None,
            volumes=options["volumes"] if options["volumes"] else None,
            environment=options["environment"] if options["environment"] else None,
            restart_policy=options["restart_policy"],
            network_mode=options["network_mode"],
            privileged=options["privileged"],
            detach=True
        )
        
        return jsonify({
            "success": True,
            "container_id": container.short_id,
            "message": f"Container {container.name or container.short_id} started successfully"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/compose/projects", methods=["GET"])
@jwt_required()
def list_compose_projects():
    """List all docker-compose projects on the host."""
    import re
    # Create the compose root folder if it doesn't exist
    run_host_command("mkdir -p /opt/easylin/compose")
    
    # Find all compose files under /opt/easylin/compose/
    find_cmd = "find /opt/easylin/compose -maxdepth 2 -name 'docker-compose.ym*' 2>/dev/null"
    res = run_host_command(find_cmd)
    if res.get("returncode") != 0:
        return jsonify({"projects": []})
        
    stdout = res.get("stdout", "")
    paths = [p.strip() for p in stdout.split("\n") if p.strip()]
    
    client = get_client()
    containers = []
    if client:
        try:
            containers = client.containers.list(all=True)
        except:
            pass
            
    projects = []
    for path in paths:
        parts = path.split('/')
        if len(parts) >= 5:
            project_name = parts[-2]
            
            # Read content of compose file
            cat_res = run_host_command(f"cat {path}")
            yml_content = cat_res.get("stdout", "")
            
            # Find containers belonging to this project
            project_containers = []
            running_count = 0
            for c in containers:
                labels = c.attrs.get("Config", {}).get("Labels", {}) or {}
                c_proj = labels.get("com.docker.compose.project")
                if c_proj == project_name:
                    project_containers.append({
                        "id": c.short_id,
                        "name": c.name,
                        "status": c.status,
                        "state": c.attrs["State"]["Status"]
                    })
                    if c.status == "running":
                        running_count += 1
                        
            status = "stopped"
            if project_containers:
                if running_count == len(project_containers):
                    status = "running"
                elif running_count > 0:
                    status = "warning"
                else:
                    status = "stopped"
                    
            projects.append({
                "name": project_name,
                "path": path,
                "yml": yml_content,
                "status": status,
                "containers": project_containers
            })
            
    return jsonify({"projects": projects})


@docker_bp.route("/compose/projects", methods=["POST"])
@jwt_required()
def create_compose_project():
    """Create a new docker-compose project."""
    import re
    import base64
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    yml = data.get("yml", "").strip()
    
    if not name or not yml:
        return jsonify({"error": "Project name and YAML content are required"}), 400
        
    # Sanitize name
    name = re.sub(r'[^a-zA-Z0-9\-_]', '', name)
    if not name:
        return jsonify({"error": "Invalid project name"}), 400
        
    # Write file using base64 to avoid quoting/shell escaping issues
    encoded_yml = base64.b64encode(yml.encode('utf-8')).decode('utf-8')
    
    write_cmd = f"mkdir -p /opt/easylin/compose/{name} && echo '{encoded_yml}' | base64 -d > /opt/easylin/compose/{name}/docker-compose.yml"
    write_res = run_host_command(write_cmd)
    
    if write_res.get("returncode") != 0:
        return jsonify({"error": f"Failed to write compose file: {write_res.get('stderr')}"}), 500
        
    # Deploy
    deploy_cmd = f"cd /opt/easylin/compose/{name} && docker compose up -d --remove-orphans"
    deploy_res = run_host_command(deploy_cmd)
    
    success = (deploy_res.get("returncode") == 0)
    return jsonify({
        "success": success,
        "stdout": deploy_res.get("stdout"),
        "stderr": deploy_res.get("stderr"),
        "message": "Compose project deployed successfully" if success else f"Deploy error: {deploy_res.get('stderr')}"
    })


@docker_bp.route("/compose/projects/<name>/<action>", methods=["POST"])
@jwt_required()
def compose_project_action(name, action):
    """Execute docker compose action (up, down, restart, pull)."""
    import re
    name = re.sub(r'[^a-zA-Z0-9\-_]', '', name)
    allowed_actions = ["up", "down", "restart", "pull"]
    if action not in allowed_actions:
        return jsonify({"error": "Invalid action"}), 400
        
    compose_path = f"/opt/easylin/compose/{name}/docker-compose.yml"
    check_res = run_host_command(f"test -f {compose_path}")
    if check_res.get("returncode") != 0:
        return jsonify({"error": "Compose project does not exist"}), 404
        
    if action == "up":
        cmd = f"cd /opt/easylin/compose/{name} && docker compose up -d --remove-orphans"
    elif action == "down":
        cmd = f"cd /opt/easylin/compose/{name} && docker compose down"
    elif action == "restart":
        cmd = f"cd /opt/easylin/compose/{name} && docker compose restart"
    elif action == "pull":
        cmd = f"cd /opt/easylin/compose/{name} && docker compose pull"
        
    res = run_host_command(cmd)
    success = (res.get("returncode") == 0)
    return jsonify({
        "success": success,
        "stdout": res.get("stdout"),
        "stderr": res.get("stderr"),
        "message": f"Action '{action}' executed successfully" if success else f"Action error: {res.get('stderr')}"
    })


@docker_bp.route("/compose/projects/<name>", methods=["DELETE"])
@jwt_required()
def delete_compose_project(name):
    """Delete a docker-compose project."""
    import re
    name = re.sub(r'[^a-zA-Z0-9\-_]', '', name)
    compose_path = f"/opt/easylin/compose/{name}/docker-compose.yml"
    
    check_res = run_host_command(f"test -d /opt/easylin/compose/{name}")
    if check_res.get("returncode") != 0:
        return jsonify({"error": "Project not found"}), 404
        
    # Clean up containers first
    run_host_command(f"cd /opt/easylin/compose/{name} && docker compose down -v")
    
    # Delete folder
    del_res = run_host_command(f"rm -rf /opt/easylin/compose/{name}")
    success = (del_res.get("returncode") == 0)
    return jsonify({
        "success": success,
        "message": "Compose project deleted successfully" if success else f"Deletion error: {del_res.get('stderr')}"
    })

