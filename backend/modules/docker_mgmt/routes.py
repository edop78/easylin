"""Docker management API — containers, images, volumes, networks."""

import docker
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
import os
import threading

import json
from database import get_db

docker_bp = Blueprint("docker", __name__)

def update_task_db(app_id, status=None, message=None, error=None, log_entry=None, logs_list=None):
    """Update task status in DB."""
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
            current_logs.append(log_entry)
            if len(current_logs) > 200:
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
                for line in client.api.pull(app_config["image"], stream=True, decode=True):
                    if "error" in line:
                        error_detail = line.get("errorDetail", {}).get("message", line["error"])
                        raise Exception(f"Pull failed: {error_detail}")
                    
                    status = line.get("status", "")
                    progress = line.get("progress", "")
                    if status:
                        log_msg(f"{status} {progress}".strip())

                # Verify image exists before running
                log_msg("Verifying image...")
                try:
                    client.images.get(app_config["image"])
                except Exception:
                    log_msg(f"Image {app_config['image']} not found after pull. Retrying high-level pull...")
                    client.images.pull(app_config["image"])

                # Run
                log_msg("Creating container...")
                client.containers.run(
                    app_config["image"],
                    name=app_config["name"],
                    ports=app_config["ports"],
                    volumes=app_config["volumes"],
                    restart_policy=app_config["restart_policy"],
                    detach=True
                )
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
        # Check if already exists (immediate check)
        try:
            client.containers.get(app_config["name"])
            return jsonify({"error": f"Container {app_config['name']} already exists"}), 409
        except Exception:
            pass

        # Initialize task status in DB
        update_task_db(app_id, status="installing", message="Initializing...", logs_list=[])

        # Start installation in background
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
    """Get status of background installations."""
    return jsonify({"tasks": get_tasks_db()})


@docker_bp.route("/market/clear/<app_id>", methods=["POST"])
@jwt_required()
def market_clear(app_id):
    """Clear a task status."""
    conn = get_db()
    try:
        conn.execute("DELETE FROM task_status WHERE app_id = ?", (app_id,))
        conn.commit()
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
