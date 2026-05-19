"""Docker management API — containers, images, volumes, networks."""

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
import os
import threading
import json
import time

from database import get_db
from utils.command import run_host_command
from .tasks import update_task_db, get_tasks_db, GLOBAL_LOGS, LOG_FILE
from .helpers import get_client, parse_docker_run, background_install, MARKET_APPS
from .compose import get_compose_projects, run_async_compose_command

docker_bp = Blueprint("docker", __name__)

@docker_bp.route("/info", methods=["GET"])
@jwt_required()
def docker_info():
    """Get Docker daemon info."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    try:
        info = client.info()
        volumes = len(client.volumes.list())
        return jsonify({
            "version": info.get("ServerVersion", ""),
            "containers": info.get("Containers", 0),
            "running": info.get("ContainersRunning", 0),
            "paused": info.get("ContainersPaused", 0),
            "stopped": info.get("ContainersStopped", 0),
            "images": info.get("Images", 0),
            "volumes": volumes,
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

    data = request.get_json() or {}
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


@docker_bp.route("/containers/run-command", methods=["POST"])
@jwt_required()
def run_container_command():
    """Parse a full docker run command and start the container."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503
        
    data = request.get_json() or {}
    command_str = data.get("command", "").strip()
    if not command_str:
        return jsonify({"error": "Command string is required"}), 400
        
    try:
        options = parse_docker_run(command_str)
        client.images.pull(options["image"])
        
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


@docker_bp.route("/images/<image_id>", methods=["DELETE"])
@jwt_required()
def remove_image(image_id):
    """Remove a Docker image."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503
    try:
        client.images.remove(image_id)
        return jsonify({"success": True})
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


@docker_bp.route("/networks", methods=["GET"])
@jwt_required()
def list_networks():
    """List Docker networks."""
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

    data = request.get_json() or {}
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

    try:
        try:
            old_c = client.containers.get(app_config['name'])
            if old_c.status != 'running':
                old_c.remove()
            else:
                return jsonify({"error": f"Container {app_config['name']} is already running"}), 409
        except Exception:
            pass

        update_task_db(app_id, status="installing", message="Initializing...", logs_list=[])

        try:
            with open(LOG_FILE, "w") as f:
                f.write(f"--- Deployment Started: {app_config['name']} ---\n")
                f.write(f"--- Time: {time.ctime()} ---\n")
        except:
            pass

        update_task_db(app_id, status="installing", message="Starting installation...", log_entry="Initializing backend deployment thread...")
        
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
        conn.execute("DELETE FROM task_status WHERE status = 'installing' AND updated_at < datetime('now', '-10 minutes')")
        conn.commit()
        
        cursor = conn.execute("SELECT app_id, status, message, error, logs, updated_at FROM task_status")
        rows = cursor.fetchall()
        
        existing_containers = []
        try:
            client = get_client()
            if client:
                existing_containers = [c.name for c in client.containers.list(all=True)]
        except:
            pass

        tasks = {}
        for row in rows:
            app_id, status, message, error, logs_json, updated_at = row
            
            container_name = app_id
            for app_cfg in MARKET_APPS:
                if app_cfg['id'] == app_id:
                    container_name = app_cfg['containerName']
                    break
            
            if status == 'installing' and container_name in existing_containers:
                status = 'installed'
                message = 'Completed (Detected)'

            mem_logs = GLOBAL_LOGS.get(app_id, [])
            try:
                logs_parsed = json.loads(logs_json) if logs_json else []
            except:
                logs_parsed = []
            tasks[app_id] = {
                "status": status,
                "message": message or "Initializing...",
                "error": error,
                "logs": mem_logs if mem_logs else logs_parsed,
                "updated_at": updated_at
            }

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
        if app_id in GLOBAL_LOGS:
            del GLOBAL_LOGS[app_id]
    finally:
        conn.close()
    return jsonify({"success": True})


@docker_bp.route("/compose/projects", methods=["GET"])
@jwt_required()
def list_compose_projects():
    """List all docker-compose projects on the host."""
    client = get_client()
    projects = get_compose_projects(client)
    return jsonify({"projects": projects})


@docker_bp.route("/compose/projects", methods=["POST"])
@jwt_required()
def create_compose_project():
    """Create a new docker-compose project (Asynchronously)."""
    import re
    import base64
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    yml = data.get("yml", "").strip()
    
    if not name or not yml:
        return jsonify({"error": "Project name and YAML content are required"}), 400
        
    name = re.sub(r'[^a-zA-Z0-9\-_]', '', name)
    if not name:
        return jsonify({"error": "Invalid project name"}), 400
        
    encoded_yml = base64.b64encode(yml.encode('utf-8')).decode('utf-8')
    
    task_id = f"compose_{name}"
    pre_cmd = f"mkdir -p /opt/easylin/compose/{name} && echo '{encoded_yml}' | base64 -d > /opt/easylin/compose/{name}/docker-compose.yml"
    deploy_cmd = f"cd /opt/easylin/compose/{name} && docker compose up -d --remove-orphans"
    
    run_async_compose_command(
        task_id=task_id,
        project_name=name,
        command=deploy_cmd,
        app=current_app._get_current_object(),
        pre_run_cmd=pre_cmd
    )
    
    return jsonify({
        "success": True,
        "message": f"Deployment of stack '{name}' started in the background.",
        "task_id": task_id
    }), 202


@docker_bp.route("/compose/projects/<name>/<action>", methods=["POST"])
@jwt_required()
def compose_project_action(name, action):
    """Execute docker compose action (up, down, restart, pull) Asynchronously."""
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
        
    task_id = f"compose_{name}"
    run_async_compose_command(
        task_id=task_id,
        project_name=name,
        command=cmd,
        app=current_app._get_current_object()
    )
    
    return jsonify({
        "success": True,
        "message": f"Action '{action}' for stack '{name}' started in the background.",
        "task_id": task_id
    }), 202


@docker_bp.route("/compose/projects/<name>", methods=["DELETE"])
@jwt_required()
def delete_compose_project(name):
    """Delete a docker-compose project (Asynchronously)."""
    import re
    name = re.sub(r'[^a-zA-Z0-9\-_]', '', name)
    compose_path = f"/opt/easylin/compose/{name}/docker-compose.yml"
    
    check_res = run_host_command(f"test -d /opt/easylin/compose/{name}")
    if check_res.get("returncode") != 0:
        return jsonify({"error": "Project not found"}), 404
        
    task_id = f"compose_{name}"
    cmd = f"cd /opt/easylin/compose/{name} && docker compose down -v && rm -rf /opt/easylin/compose/{name}"
    
    run_async_compose_command(
        task_id=task_id,
        project_name=name,
        command=cmd,
        app=current_app._get_current_object()
    )
    
    return jsonify({
        "success": True,
        "message": f"Deletion of stack '{name}' started in the background.",
        "task_id": task_id
    }), 202
