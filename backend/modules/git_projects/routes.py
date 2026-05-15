from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from utils.command import run_host_command
import os
import json
import sqlite3
from datetime import datetime

git_projects_bp = Blueprint("git_projects", __name__)

DB_PATH = "data/easylin.db"

def init_git_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS git_projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            repo_url TEXT NOT NULL,
            local_path TEXT NOT NULL,
            post_build_cmds TEXT,
            last_sync TEXT,
            status TEXT DEFAULT 'idle'
        )
    """)
    conn.commit()
    conn.close()

init_git_db()

@git_projects_bp.route("", methods=["GET"])
@git_projects_bp.route("/", methods=["GET"])
@jwt_required()
def list_projects():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    projects = [dict(row) for row in cursor.execute("SELECT * FROM git_projects").fetchall()]
    conn.close()
    return jsonify({"projects": projects})

@git_projects_bp.route("/clone", methods=["POST"])
@jwt_required()
def clone_project():
    data = request.get_json()
    name = data.get("name")
    repo_url = data.get("repo_url")
    local_path = data.get("local_path")
    post_build_cmds = data.get("post_build_cmds", "")

    if not name or not repo_url or not local_path:
        return jsonify({"error": "Missing mandatory fields"}), 400

    # Ensure path is absolute and clean
    local_path = os.path.abspath(local_path)
    
    # 1. Try to clone
    cmd = f"git clone {repo_url} {local_path}"
    res = run_host_command(cmd)
    
    if res["returncode"] != 0:
        return jsonify({"error": f"Clone failed: {res['stderr'] or res['stdout']}"}), 500

    # 2. Save to DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO git_projects (name, repo_url, local_path, post_build_cmds, last_sync)
        VALUES (?, ?, ?, ?, ?)
    """, (name, repo_url, local_path, post_build_cmds, datetime.now().isoformat()))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Project cloned and registered."})

@git_projects_bp.route("/<int:project_id>/sync", methods=["POST"])
@jwt_required()
def sync_project(project_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    project = cursor.execute("SELECT * FROM git_projects WHERE id = ?", (project_id,)).fetchone()
    
    if not project:
        conn.close()
        return jsonify({"error": "Project not found"}), 404

    path = project["local_path"]
    cmds = project["post_build_cmds"].split("\n") if project["post_build_cmds"] else []
    
    execution_log = []
    
    # 1. Git Pull
    execution_log.append(f"--- Starting Sync for {project['name']} ---")
    pull_res = run_host_command(f"git -C {path} pull")
    execution_log.append(f"GIT PULL: {pull_res['stdout'] or pull_res['stderr']}")
    
    if pull_res["returncode"] != 0:
        conn.close()
        return jsonify({"success": False, "log": "\n".join(execution_log), "error": "Git pull failed"}), 500

    # 2. Post-Build Commands
    for cmd in cmds:
        cmd = cmd.strip()
        if not cmd: continue
        
        execution_log.append(f"\nEXECUTING: {cmd}")
        # Run command inside the project directory
        cmd_res = run_host_command(f"cd {path} && {cmd}")
        execution_log.append(cmd_res["stdout"] or cmd_res["stderr"])
        
        if cmd_res["returncode"] != 0:
            execution_log.append(f"ERROR: Command failed with exit code {cmd_res['returncode']}")
            break

    # 3. Update Last Sync
    cursor.execute("UPDATE git_projects SET last_sync = ? WHERE id = ?", (datetime.now().isoformat(), project_id))
    conn.commit()
    conn.close()

    return jsonify({
        "success": True, 
        "log": "\n".join(execution_log)
    })

@git_projects_bp.route("/<int:project_id>", methods=["DELETE"])
@jwt_required()
def delete_project(project_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM git_projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})
