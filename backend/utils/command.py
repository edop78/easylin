"""Safe command execution on the host system."""

import subprocess
import shlex
import logging
from config import Config

logger = logging.getLogger("easylin.command")


def run_host_command(command, timeout=30, shell=True):
    """Execute a command on the host system.

    When running inside Docker, uses nsenter to execute
    commands in the host's namespaces.

    Returns:
        dict with 'stdout', 'stderr', 'returncode'
    """
    if Config.IN_DOCKER:
        if shell:
            full_cmd = (
                f"nsenter --target 1 --mount --uts --ipc --net --pid "
                f"-- /bin/bash -c {shlex.quote(command)}"
            )
        else:
            full_cmd = f"nsenter --target 1 --mount --uts --ipc --net --pid -- {command}"
    else:
        full_cmd = command

    try:
        result = subprocess.run(
            full_cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        logger.warning(f"Host command timed out after {timeout}s: {command}")
        return {
            "stdout": "",
            "stderr": "Command timed out",
            "returncode": -1,
        }
    except Exception as e:
        logger.exception(f"Unhandled exception running host command: {command}")
        return {
            "stdout": "",
            "stderr": str(e),
            "returncode": -1,
        }


def run_host_command_stream(command, timeout=120):
    """Execute a long-running command and return output as it comes.

    Returns the full result after completion.
    """
    return run_host_command(command, timeout=timeout)
