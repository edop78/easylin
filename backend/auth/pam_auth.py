"""PAM-style authentication against host system users."""

try:
    import crypt
except ImportError:
    crypt = None
import subprocess
from config import Config


def authenticate_user(username, password):
    """Authenticate a user against the host /etc/shadow file.

    Returns True if credentials are valid, False otherwise.
    """
    shadow_path = f"{Config.HOST_ROOT}/etc/shadow" if Config.IN_DOCKER else "/etc/shadow"

    if not crypt:
        return False

    try:
        with open(shadow_path, "r") as f:
            for line in f:
                parts = line.strip().split(":")
                if parts[0] == username:
                    stored_hash = parts[1]
                    # Account is locked or has no password
                    if stored_hash in ("!", "*", "!!", ""):
                        return False
                    # Verify password using crypt
                    return crypt.crypt(password, stored_hash) == stored_hash
        return False
    except (FileNotFoundError, PermissionError):
        return False


def user_has_sudo(username):
    """Check if a user has sudo privileges."""
    try:
        # Check sudo group membership
        groups_file = f"{Config.HOST_ROOT}/etc/group" if Config.IN_DOCKER else "/etc/group"
        with open(groups_file, "r") as f:
            for line in f:
                parts = line.strip().split(":")
                group_name = parts[0]
                members = parts[3].split(",") if len(parts) > 3 and parts[3] else []
                if group_name in ("sudo", "wheel", "root") and username in members:
                    return True
        # Also check if user is root
        if username == "root":
            return True
        return False
    except (FileNotFoundError, PermissionError):
        return False
