"""Docker management API — containers, images, volumes, networks."""

import docker
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import os

docker_bp = Blueprint("docker", __name__)


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
            container.remove(force=True)
        else:
            getattr(container, action)()
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


@docker_bp.route("/containers/run", methods=["POST"])
@jwt_required()
def run_container():
    """Run a custom container manually or from GitHub."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    data = request.get_json()
    install_type = data.get("type", "image") # "image" or "github"
    image_or_repo = data.get("image") # can be image name or git URL
    name = data.get("name")
    ports_raw = data.get("ports", "")
    
    if not image_or_repo:
        return jsonify({"error": "Image name or Repository URL is required"}), 400

    # Parse ports
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

        # Build if GitHub
        if install_type == "github":
            tag = name if name else "custom-app-build"
            # Docker build from URL (supports git urls)
            # path is the git repo URL
            client.images.build(path=image_or_repo, tag=tag, rm=True)
            final_image = tag

        elif install_type == "image":
            # Pull image
            client.images.pull(image_or_repo)

        # Run container
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


@docker_bp.route("/market/install", methods=["POST"])
@jwt_required()
def market_install():
    """Install a predefined app from the marketplace."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    data = request.get_json()
    app_id = data.get("app_id")

    # App definitions
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
        }
    }

    app_config = apps.get(app_id)
    if not app_config:
        return jsonify({"error": "Unknown app"}), 400

    try:
        # Check if already exists
        try:
            client.containers.get(app_config["name"])
            return jsonify({"error": f"Container {app_config['name']} already exists"}), 409
        except Exception:
            pass

        # Pull and create
        client.images.pull(app_config["image"])
        container = client.containers.run(
            app_config["image"],
            name=app_config["name"],
            ports=app_config["ports"],
            volumes=app_config["volumes"],
            restart_policy=app_config["restart_policy"],
            detach=True
        )
        return jsonify({
            "success": True, 
            "container_id": container.short_id,
            "message": f"{app_config['name']} installed and started"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/images", methods=["GET"])
@jwt_required()
def list_images():
    """List Docker images."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    try:
        images = client.images.list()
        result = []
        for img in images:
            result.append({
                "id": img.short_id,
                "tags": img.tags,
                "size": img.attrs.get("Size", 0),
                "created": img.attrs.get("Created", ""),
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
        client.images.remove(image_id, force=True)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@docker_bp.route("/volumes", methods=["GET"])
@jwt_required()
def list_volumes():
    """List Docker volumes."""
    client = get_client()
    if not client:
        return jsonify({"error": "Cannot connect to Docker daemon"}), 503

    try:
        volumes = client.volumes.list()
        result = []
        for v in volumes:
            result.append({
                "name": v.name,
                "driver": v.attrs.get("Driver", ""),
                "mountpoint": v.attrs.get("Mountpoint", ""),
                "created": v.attrs.get("CreatedAt", ""),
            })
        return jsonify({"volumes": result})
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
