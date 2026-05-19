# EasyLin AI Module - Technical Knowledge Base

## CRITICAL: Containerized Execution Context
- **EasyLin Runs Inside Docker**: EasyLin is designed as a privileged containerized application.
- **Self-Destruction Warning**: Because it runs within Docker, **never** execute any administrative command that mutates or restarts the Docker service or the Docker engine itself (such as upgrading `docker-ce`, `docker-ce-cli`, or `containerd.io`). Doing so will instantly terminate the Docker daemon, killing the EasyLin container mid-execution, severing the network connection (502 Bad Gateway), and leaving package locks broken.
- **Safeguard**: Always run `apt-mark hold` on all Docker-related packages before initiating automated host package upgrades.

## 1. Network Architecture
- **Mode**: `network_mode: host` (defined in `docker-compose.yml`).
- **Communication**: The backend container shares the host network stack.
- **Ollama API**: Primary endpoint is `http://127.0.0.1:11434/api`.
- **Fallback Endpoints**: `localhost`, `host.docker.internal` (if bridged), and `ollama` (if containerized).

## 2. Database Schema (easylin.db)
### Table: `chat_messages`
| Column | Type | Description |
| --- | --- | --- |
| id | INTEGER | Primary Key (Auto-increment) |
| model | TEXT | Model name (e.g., qwen2.5:3b) |
| role | TEXT | assistant or user |
| content | TEXT | Message body |
| created_at | TIMESTAMP | Default CURRENT_TIMESTAMP |

### Table: `ai_permissions`
| Column | Type | Description |
| --- | --- | --- |
| capability | TEXT | Primary Key (e.g., shell_exec, docker_mgmt) |
| enabled | INTEGER | 0 (Disabled) or 1 (Enabled) |
| level | TEXT | low, medium, or high |
| description | TEXT | Human-readable description |
| updated_at | TIMESTAMP | Last modification time |

## 3. Critical Capabilities
| Capability | Level | Purpose |
| --- | --- | --- |
| `system_info` | low | Basic metrics and OS info |
| `docker_mgmt` | medium | Container lifecycle |
| `file_read` | medium | System inspection |
| `file_write` | high | Host mutation |
| `shell_exec` | high | Arbitrary execution |

## 4. Operational Protocols
1. **Always verify** Ollama connectivity via `check_ollama()` before critical operations.
2. **Use streaming** (SSE) for both Chat and Model Pull to prevent gateway timeouts (504).
3. **Tool calls** should be preceded by a status update to the frontend (e.g., "Executing tool...").
4. **Never hallucinate** container IDs; always run `list_containers` first.

## 5. Host Interaction & Namespace Fallbacks
- **Active Sessions Card**: Standard `psutil.users()` inside containerized environments returns empty due to PID namespace isolation. Fall back to parsing the host `who` command executed inside the host namespace:
  `nsenter --target 1 --mount --uts --ipc --net --pid -- who`
- **Host Execution Wrapper**: EasyLin executes administrative tasks directly in the host OS namespace using `nsenter --target 1 --mount --uts --ipc --net --pid -- /bin/bash -c "<command>"`.

## 6. Long-Running System Tasks & Maintenance
- **DO NOT USE SSE (Server-Sent Events) streaming** for system maintenance or administrative tasks (like `apt-get upgrade`). SSE streams are extremely fragile behind reverse proxies (Nginx/Cloudflare) due to strict HTTP/3 (QUIC) stream resets (`net::ERR_QUIC_PROTOCOL_ERROR`), browser UDP firewalls, and proxy timeout limits (e.g., Cloudflare 100s limit).
- **ALWAYS USE Asynchronous Background Threads + REST Polling**:
  1. Spawns a background thread to run the process on the host via `subprocess.Popen` + `nsenter`.
  2. Write output (stdout/stderr) in real-time to a persistent log file in the container's volume (e.g., `/app/data/maintenance_logs/<task_id>.log`).
  3. Instantly returns `200 OK` on task start, bypassing any HTTP/proxy gateway timeout.
  4. The frontend polls a standard REST endpoint `GET /api/system/maintenance/status/<task_id>` every 1.5 seconds to read the log file content.
  5. *State Persistence Benefit*: If the user refreshes their browser or closes the tab, the task continues running safely on the server, and the UI resumes polling upon reload.

## 7. Package Manager (APT) Safety & Interceptors
- **Non-Interactive Commands**: To prevent automated scripts from hanging indefinitely on configuration prompts, always prefix and wrap apt actions:
  `DEBIAN_FRONTEND=noninteractive apt-get <action> -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"`
- **Dpkg Lock Auto-Repair Interceptor**: If an APT command fails due to `"dpkg was interrupted"`, programmatically intercept it, run `dpkg --configure -a` in the host namespace, and retry the original command automatically.

## 8. Python Version Compatibility Safeguards
- **No Backslashes in f-string Expressions**: Do **NOT** use backslashes (like `\n` or `\"`) inside f-string expressions `{...}` (e.g., `{json.dumps('\n')}`). In Python < 3.12 (Debian 12 / Ubuntu 22.04), this throws a fatal `SyntaxError` on import. Since EasyLin's `app.py` imports modules inside a `try/except` to prevent complete server crash, this `SyntaxError` will silently bypass Gunicorn crash checks but leave the affected blueprint/module completely unregistered. Always define JSON/string payloads outside f-strings before yielding/returning.

## 9. Latency & CPU Optimizations for Low-Power Hosts
To make local LLMs usable on low-spec/CPU-only servers, the AI route implements several aggressive optimization strategies:
- **Dynamic Tool Selection**: Instead of passing all tool definitions to the LLM (which inflates the system context and causes high prefill times), the backend inspects the user query and dynamically selects only the relevant tool schemas (e.g., only container-related tools if the query mentions "docker").
- **Sliding Memory Window**: Restricts the context to the last 5 messages, avoiding the exponential increase in response delay as the chat history grows.
- **Fast-Response Generation in Python**: When a tool is invoked, the backend executes the tool and immediately formats a natural-language Italian response on the fly. It streams this response to the client directly, bypassing a second slow LLM inference turn.
- **Robust Fallback Parser**: Includes a regex and brace-matching parser to extract tool invocations even if lightweight models format the request as plain text/JSON blocks instead of using the official API tool schemas.

## 10. Security Advisor, Command Dictionary & Auto-Logout Reference
- **Security Audits & Parsing Safeguards**: When parsing commands like `ufw status` to determine firewall active states, avoid simple substring checks (e.g., checking `"active" in stdout`) as they match `"inactive"`. Explicitly verify `"status: active" in stdout or ("active" in stdout and "inactive" not in stdout)`.
- **Systemctl Newline Stripping**: Output from `systemctl is-active` contains trailing newline characters (`\n`). Always run `.strip()` on stdout before testing equality (e.g., `stdout.strip() == "active"`).
- **Auto-Remediation Registry**: Every security audit warning is mapped to a background host-level remediation command (UFW enablement, SSH custom ports configuration, root ssh key chmod, etc.) allowing one-click resolution.
- **Inactivity Session Timeout**: Handles browser session hijacking by binding a `15-minute` auto-logout timer on client-side keyboard/mouse activity listeners (`mousemove`, `keydown`, `click`, `scroll`, `touchstart`). If inactivity triggers, it clears local credentials and passes a redirection reason string via `localStorage` to display on the login page.
