import os
import sys
import socket
import platform
import psutil
import datetime
import subprocess
import shlex
import re

try:
    from config import Config
except ImportError:
    from backend.config import Config

# Helper to import run_host_command safely
def get_run_command():
    try:
        from backend.utils.command import run_host_command
        return run_host_command
    except ImportError:
        try:
            from utils.command import run_host_command
            return run_host_command
        except ImportError:
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
            try:
                from backend.utils.command import run_host_command
                return run_host_command
            except:
                return lambda cmd, **kwargs: {"stdout": "", "stderr": "Command utility not found", "returncode": 1}

run_host_command = get_run_command()

def get_container_id():
    # 1. Try from mountinfo
    try:
        if os.path.exists("/proc/self/mountinfo"):
            with open("/proc/self/mountinfo", "r") as f:
                for line in f:
                    m = re.search(r"/docker/containers/([0-9a-fA-F]{64})/", line)
                    if m:
                        return m.group(1)[:12]
                    m = re.search(r"/containers/([0-9a-fA-F]{64})/", line)
                    if m:
                        return m.group(1)[:12]
    except Exception:
        pass

    # 2. Try from cgroup
    try:
        if os.path.exists("/proc/self/cgroup"):
            with open("/proc/self/cgroup", "r") as f:
                for line in f:
                    m = re.search(r"([0-9a-fA-F]{64})", line)
                    if m:
                        return m.group(1)[:12]
    except Exception:
        pass

    # 3. Try from hostname
    try:
        hn = socket.gethostname()
        if len(hn) == 12 and re.match(r"^[0-9a-fA-F]{12}$", hn):
            return hn
    except Exception:
        pass
    return "easylin"

def get_project_dir():
    # Method A: docker inspect
    container_id = get_container_id()
    if container_id and container_id != "easylin":
        cmd = f"docker inspect {container_id} --format '{{{{ index .Config.Labels \"com.docker.compose.project.working_dir\" }}}}'"
        res = run_host_command(cmd)
        if res.get("returncode") == 0:
            p_dir = res.get("stdout", "").strip()
            if p_dir:
                return p_dir

    # Method B: Search `/home` and `/root` on the host if Docker inspect failed
    find_cmd = "find /home /root -maxdepth 3 -name 'docker-compose.yml' 2>/dev/null"
    find_res = run_host_command(find_cmd)
    if find_res.get("returncode") == 0:
        paths = [p.strip() for p in find_res.get("stdout", "").split("\n") if p.strip()]
        for path in paths:
            parent = os.path.dirname(path)
            check_cmd = f"[ -f {shlex.quote(parent)}/.env.example ] && echo 'yes' || echo 'no'"
            check_res = run_host_command(check_cmd)
            if check_res.get("stdout", "").strip() == "yes":
                return parent
    return ""

def get_temp_status_path():
    if getattr(Config, 'IN_DOCKER', False) or os.path.exists("/host/tmp"):
        return "/host/tmp/easylin_update_status.json"
    return "/tmp/easylin_update_status.json"

def get_system_info_data():
    # Local IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except:
        local_ip = "N/A"

    # Public IP
    try:
        res_pub = run_host_command("curl -s --connect-timeout 2 https://api.ipify.org")
        public_ip = res_pub.get("stdout", "").strip() if res_pub and res_pub.get("returncode") == 0 else "N/A"
    except:
        public_ip = "N/A"
    
    # Virtualization
    try:
        res_virt = run_host_command("systemd-detect-virt")
        virt = res_virt.get("stdout", "physical").strip() if res_virt and res_virt.get("returncode") == 0 else "physical"
    except:
        virt = "physical"
    
    # Boot time
    try:
        bt = datetime.datetime.fromtimestamp(psutil.boot_time()).strftime("%Y-%m-%d %H:%M:%S")
    except:
        bt = "N/A"

    # Uptime
    try:
        res_up = run_host_command("uptime -p")
        uptime = res_up.get("stdout", "N/A").strip().replace("up ", "") if res_up and res_up.get("returncode") == 0 else "N/A"
    except:
        uptime = "N/A"

    # OS Info
    os_name = "Linux"
    try:
        if os.path.exists("/etc/os-release"):
            with open("/etc/os-release") as f:
                for line in f:
                    if line.startswith("PRETTY_NAME="):
                        os_name = line.split("=")[1].strip().replace('"', '')
                        break
    except:
        os_name = platform.system()

    # CPU Temperature
    temp = None
    try:
        # Metodo standard Linux sysfs
        for i in range(10):
            path = f"/sys/class/thermal/thermal_zone{i}/type"
            if os.path.exists(path):
                with open(path, 'r') as f:
                    if 'pkg_temp' in f.read() or 'cpu' in f.read().lower():
                        with open(f"/sys/class/thermal/thermal_zone{i}/temp", 'r') as tf:
                            temp = int(tf.read().strip()) / 1000.0
                            break
        if temp is None and hasattr(psutil, "sensors_temperatures"):
            temps = psutil.sensors_temperatures()
            if 'coretemp' in temps:
                temp = temps['coretemp'][0].current
    except:
        temp = None

    # NTP & Timezone
    timezone = "UTC"
    ntp_active = False
    try:
        res_time = run_host_command("timedatectl show --property=Timezone,NTP")
        time_data = res_time.get("stdout", "")
        for line in time_data.split("\n"):
            if line.startswith("Timezone="):
                timezone = line.split("=")[1]
            if line.startswith("NTP="):
                ntp_active = line.split("=")[1] == "yes"
    except:
        pass

    # Active Sessions (SSH/Local)
    sessions = []
    try:
        for user in psutil.users():
            sessions.append({
                "name": user.name,
                "terminal": user.terminal,
                "host": user.host,
                "started": datetime.datetime.fromtimestamp(user.started).strftime("%Y-%m-%d %H:%M")
            })
    except:
        pass

    # Fallback: who command
    if not sessions:
        try:
            res_who = run_host_command("who")
            if res_who.get("returncode") == 0 and res_who.get("stdout"):
                for line in res_who["stdout"].split("\n"):
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split()
                    if len(parts) >= 4:
                        name = parts[0]
                        terminal = parts[1]
                        started_date = parts[2]
                        started_time = parts[3]
                        host = ""
                        if len(parts) >= 5:
                            host = parts[4].strip("()")
                        
                        sessions.append({
                            "name": name,
                            "terminal": terminal,
                            "host": host or "localhost",
                            "started": f"{started_date} {started_time}"
                        })
        except:
            pass

    # Get Timezone
    try:
        res_tz = run_host_command("timedatectl show --property=Timezone --value")
        timezone = res_tz.get("stdout", "UTC").strip()
    except:
        timezone = "UTC"

    return {
        "hostname": socket.gethostname(),
        "os": os_name,
        "kernel": platform.release(),
        "arch": platform.machine(),
        "uptime": uptime,
        "cpu_count": psutil.cpu_count(),
        "cpu_temp": temp,
        "local_ip": local_ip,
        "public_ip": public_ip,
        "virtualization": virt,
        "boot_time": bt,
        "timezone": timezone,
        "ntp_active": ntp_active,
        "active_sessions": sessions
    }
