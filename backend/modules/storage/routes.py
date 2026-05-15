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
    
    # 2. Enrich with SMART status and protect critical partitions
    for dev in devices:
        if dev['type'] == 'disk':
            dev_path = f"/dev/{dev['name']}"
            smart_res = run_host_command(f"smartctl -H {dev_path}")
            dev['smart_status'] = "PASSED" if "PASSED" in smart_res.get("stdout", "") else "UNKNOWN/FAILED"
            
            # Enrich children (partitions)
            for part in dev.get("children", []):
                # Mark as critical if mounted on / or /boot, or if it's a tiny boot partition
                mount = part.get("mountpoint")
                size = part.get("size", "")
                is_boot_size = size.endswith('M') and int(size.replace('M', '')) <= 2
                
                if mount in ["/", "/boot", "/boot/efi"] or is_boot_size:
                    part['critical'] = True
                else:
                    part['critical'] = False

            # Check for bad sectors
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

@storage_bp.route("/mount-local", methods=["POST"])
@jwt_required()
def mount_local():
    data = request.get_json()
    device = data.get("device") # e.g. /dev/sdb1
    mountpoint = data.get("mountpoint")
    fstype = data.get("fstype", "auto")
    
    if not device or not mountpoint:
        return jsonify({"error": "Device and mountpoint required"}), 400

    # 1. Get UUID for stable mounting
    uuid_res = run_host_command(f"blkid -s UUID -o value {device}")
    uuid = uuid_res.get("stdout", "").strip()
    
    if not uuid:
        return jsonify({"error": f"Could not find UUID for {device}"}), 400

    if not os.path.exists(mountpoint):
        os.makedirs(mountpoint, exist_ok=True)

    # 2. Backup fstab
    run_host_command("cp /etc/fstab /etc/fstab.bak")
    
    # 3. Add to fstab using UUID (the professional way)
    fstab_entry = f"UUID={uuid} {mountpoint} {fstype} defaults 0 2"
    with open("/etc/fstab", "a") as f:
        f.write(f"\n# Added by EasyLin (Local Disk)\n{fstab_entry}\n")
    
    # 4. Mount
    res = run_host_command("mount -a")
    if res.get("returncode") == 0:
        return jsonify({"success": True, "message": "Disk mounted and persisted."})
    else:
        run_host_command("cp /etc/fstab.bak /etc/fstab")
        return jsonify({"success": False, "error": res.get("stderr")}), 500
