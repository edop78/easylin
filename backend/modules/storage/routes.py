from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from utils.command import run_host_command
import os
import re
import shlex

storage_bp = Blueprint("storage", __name__)

@storage_bp.route("/disks", methods=["GET"])
@jwt_required()
def list_disks():
    """List physical disks, partitions and SMART health."""
    # 1. Get disk structure using lsblk
    res = run_host_command("lsblk -J -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL,SERIAL")
    try:
        import json
        lsblk_data = json.loads(res.get("stdout", "{}"))
    except:
        lsblk_data = {"blockdevices": []}

    devices = lsblk_data.get("blockdevices", [])
    
    # 2. Enrich with SMART status for physical disks
    for dev in devices:
        if dev['type'] == 'disk':
            dev_path = f"/dev/{dev['name']}"
            smart_res = run_host_command(f"smartctl -H {dev_path}")
            # Simple check for PASSED status
            dev['smart_status'] = "PASSED" if "PASSED" in smart_res.get("stdout", "") else "UNKNOWN/FAILED"
            
            # Check for bad sectors if possible
            attr_res = run_host_command(f"smartctl -A {dev_path}")
            dev['bad_sectors'] = 0
            # Look for Reallocated_Sector_Ct
            match = re.search(r'Reallocated_Sector_Ct\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(\d+)', attr_res.get("stdout", ""))
            if match:
                dev['bad_sectors'] = int(match.group(1))

    return jsonify({"devices": devices})

@storage_bp.route("/unmount", methods=["POST"])
@jwt_required()
def unmount_disk():
    data = request.get_json()
    mountpoint = data.get("mountpoint")
    
    if not mountpoint:
        return jsonify({"error": "Mountpoint required"}), 400

    # Try standard unmount
    safe_path = shlex.quote(mountpoint)
    res = run_host_command(f"umount {safe_path}")
    
    if res.get("returncode") == 0:
        return jsonify({"success": True, "message": "Unmounted successfully"})
    
    # If failed, check for busy processes
    if "target is busy" in res.get("stderr", "").lower():
        # Get pids using fuser
        fuser_res = run_host_command(f"fuser -vm {safe_path}")
        lines = fuser_res.get("stdout", "").strip().split("\n")
        
        blocking_processes = []
        # Parse fuser output (skip header)
        for line in lines[1:]:
            parts = line.split()
            if len(parts) >= 3:
                pid = parts[1]
                # Get process name
                ps_res = run_host_command(f"ps -p {pid} -o comm=")
                blocking_processes.append({
                    "pid": pid,
                    "name": ps_res.get("stdout", "unknown").strip(),
                    "user": parts[0]
                })
        
        return jsonify({
            "success": False, 
            "error": "busy", 
            "processes": blocking_processes,
            "message": "Target is busy. Terminate processes to unmount."
        }), 409
        
    return jsonify({"success": False, "error": res.get("stderr")}), 500

@storage_bp.route("/force-unmount", methods=["POST"])
@jwt_required()
def force_unmount():
    data = request.get_json()
    mountpoint = data.get("mountpoint")
    safe_path = shlex.quote(mountpoint)
    
    # 1. Kill processes using the mountpoint
    run_host_command(f"fuser -km {safe_path}")
    
    # 2. Try unmount again (lazy unmount as fallback)
    res = run_host_command(f"umount -l {safe_path}")
    
    if res.get("returncode") == 0:
        return jsonify({"success": True, "message": "Force unmounted successfully"})
    return jsonify({"success": False, "error": res.get("stderr")}), 500

@storage_bp.route("/mount-nas", methods=["POST"])
@jwt_required()
def mount_nas():
    data = request.get_json()
    nas_type = data.get("type") # nfs or cifs
    server_path = data.get("path")
    mountpoint = data.get("mountpoint")
    options = data.get("options", "defaults")
    username = data.get("username")
    password = data.get("password")
    
    if not os.path.exists(mountpoint):
        os.makedirs(mountpoint, exist_ok=True)
    
    fstab_entry = ""
    if nas_type == "nfs":
        fstab_entry = f"{server_path} {mountpoint} nfs {options} 0 0"
    elif nas_type == "cifs":
        # Create credentials file for safety
        creds_path = f"/etc/easylin/creds_{mountpoint.replace('/', '_')}"
        os.makedirs("/etc/easylin", exist_ok=True)
        with open(creds_path, 'w') as f:
            f.write(f"username={username}\npassword={password}\n")
        os.chmod(creds_path, 0o600)
        fstab_entry = f"{server_path} {mountpoint} cifs credentials={creds_path},{options} 0 0"

    # Backup fstab
    run_host_command("cp /etc/fstab /etc/fstab.bak")
    
    # Append to fstab
    with open("/etc/fstab", "a") as f:
        f.write(f"\n# Added by EasyLin\n{fstab_entry}\n")
    
    # Mount all
    res = run_host_command("mount -a")
    if res.get("returncode") == 0:
        return jsonify({"success": True, "message": "NAS mounted and persisted."})
    else:
        # Rollback fstab if failed
        run_host_command("cp /etc/fstab.bak /etc/fstab")
        return jsonify({"success": False, "error": res.get("stderr")}), 500
