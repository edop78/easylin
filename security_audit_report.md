# EasyLin — Security Audit & Vulnerability Analysis Report

This report presents a thorough security audit of the **EasyLin** system architecture, source code, and deployment configuration. EasyLin is designed as an administrative dashboard to control host Linux servers from a containerized environment. 

---

##  EXECUTIVE SUMMARY

EasyLin balances two conflicting requirements: **high-level host control** (e.g., managing system services, storage, and firewalls) and **strict security partitioning**. 

Overall, the security architecture is **highly robust** for a self-hosted admin panel. Secrets are randomly generated on deployment, brute-force limits protect the login endpoint, and actions are locked behind JWT authentication. However, since the container runs with `privileged: true`, `pid: host`, and `network_mode: host`, **the container has the same power as a root shell on the host**. 

Below is the detailed breakdown of the threat landscape, active defenses, and recommendations.

---

## 1. DOCKER & HOST ISOLATION BOUNDARY
*Status: **Designed for Root Administration** (High Privilege)*

### The Architecture
EasyLin runs with the following settings in `docker-compose.yml`:
* `privileged: true`: Grants the container direct access to all host devices.
* `pid: host`: Merges the container's PID namespace with the host's PID namespace.
* `network_mode: host`: Bypasses virtual bridges, attaching the container directly to the host's network interfaces.
* `/var/run/docker.sock` mount: Grants control over the host's Docker daemon.
* `/:/host:ro` mount: Mounts the host root directory inside the container as Read-Only.

### Threat & Safety Analysis
* **Host Control Mode (`nsenter`)**: Rather than running terminal commands inside the container, EasyLin executes tasks in the host's namespaces using:
  `nsenter --target 1 --mount --uts --ipc --net --pid -- /bin/bash -c "<command>"`
  This is the industry-standard way for containerized panels (like Rancher or Cockpit) to manage the host system.
* **Privileged Container Risk**: If a remote code execution (RCE) vulnerability is found in the EasyLin Flask backend, the attacker instantly gains root privileges on the host server.
* **Mitigation**: Access to the EasyLin dashboard must be strictly controlled, firewalled, and restricted to local networks or secured via VPNs/reverse proxies (e.g., Cloudflare Access).

---

## 2. AUTHENTICATION & ACCESS CONTROL
*Status: **Strong & Secure** (PAM + JWT)*

### Active Defenses
1. **PAM-based Linux Authentication (`pam_auth.py`)**:
   * Instead of managing a separate database of users, EasyLin reads the host shadow file `/host/etc/shadow` (read-only mount) to verify password hashes using Python's native `crypt.crypt()`.
   * **Strength**: This guarantees that only valid host system users can log in.
2. **Administrative Lockout**:
   * Even with valid system credentials, only users who belong to the **`sudo`**, **`wheel`**, or **`root`** groups are permitted to log in (`user_has_sudo()`). If a standard user logs in, they are blocked with a `403 Forbidden`.
3. **Stateless JWT Tokens**:
   * Once authenticated, a secure JSON Web Token is generated. All administrative API routes (Docker, terminal, firewall, files) are protected with `@jwt_required()`.
4. **Secret Keys Generation**:
   * In `install.sh`, EasyLin dynamically generates random 256-bit hexadecimal keys for `SECRET_KEY` and `JWT_SECRET_KEY` on initial setup:
     `SECRET=$(openssl rand -hex 32)`
     This prevents pre-calculated session hijacking or JWT forging.

### Vulnerability Analysis
* **Future Deprecation of `crypt`**: The `crypt` module was deprecated in Python 3.11 and completely removed in Python 3.13. Because your `Dockerfile` uses `python:3.12-slim-bookworm`, it currently works perfectly. If the image is updated to Python 3.13+, login will fail.
* **Token Lifetime**: `JWT_ACCESS_TOKEN_EXPIRES` is set to 24 hours. For maximum security, this could be shortened (e.g., 2–4 hours) to limit the window of opportunity if a token is stolen.

---

## 3. INPUTS SANITIZATION & SHELL INJECTION PREVENTION
*Status: **Well-Protected** (API-Driven)*

### Analysis of Command Execution
* **Docker command line parser (`parse_docker_run`)**:
  When you paste a custom command like `docker run -d -p 8080:80 nginx:latest`, the system **does not** run a raw shell command on the host. Instead, it parses the string using `shlex.split` and passes the configurations to the official Python `docker` SDK (`docker-py`), which communicates directly with the Docker socket. **This completely eliminates shell injection risk for Docker custom deployments.**
* **Shell quotation**:
  In version tracking, the project path is escaped using `shlex.quote(project_dir)`, preventing any path manipulation or shell injection if a folder name contains special characters.

### Critical Areas
* **Interactive Terminal (`/api/terminal/execute`)**:
  This endpoint executes raw shell commands on the host on behalf of the user. While this is the intended behavior of a terminal dashboard, it means that any compromise of the JWT token allows full terminal access.
* **File Manager / System Logs**:
  File paths are joined using `os.path.join`. We should ensure that path traversal attacks (e.g., passing `../../etc/shadow` in file requests) are strictly blocked by validating that resolved paths stay within permitted mount bounds.

---

## 4. NETWORK SECURITY & HEADERS
*Status: **Good** (Talisman + Rate Limiting)*

### Active Defenses
* **Flask Talisman**: Configured in `app.py`. It forces security headers (X-Frame-Options, X-Content-Type-Options, HSTS).
* **Flask-Limiter**: Attaches rate limits globally (`1000 per day`, `200 per hour`) to prevent automated API scraping and resource exhaustion.

### Vulnerability Analysis
* **Talisman configuration**:
  `content_security_policy=None` is set to prevent breaking Single Page Application (SPA) routing, and `force_https=False` is set to allow local access. 
  * **Recommendation**: If EasyLin is exposed to the internet, HTTPS **must** be enforced via the Reverse Proxy module (Nginx Proxy Manager), which EasyLin lets you install in one click.

---

## 5. DOCKER SOCKET SECURITY
*Status: **Sensitive** (Container Breakout Vector)*

* Communicating with the `/var/run/docker.sock` socket is required for the App Store to work, but it is equivalent to granting root privileges on the host.
* **Safeguard**: EasyLin is designed to run in a private, local administrative scope. As long as the dashboard is not exposed publicly without a secure reverse proxy and strong credentials, this is a completely acceptable risk for an admin panel.

---

## RECOMMENDATIONS & ACTION ITEMS
*(No modifications have been done yet, as requested)*

1. **Path Traversal Protection (File Manager)**:
   Add a path validator in `files/routes.py` to ensure that users cannot navigate outside the designated `/host` or project directory by injecting `../` in the path parameters.
2. **Python 3.13 Compatibility (Auth)**:
   Rewrite `authenticate_user()` to use `ctypes` to link to the standard C library `crypt` function, or use the `passlib` library. This will make EasyLin 100% compatible with future Python 3.13+ versions when the `crypt` library is removed.
3. **Session Timeout**:
   Reduce JWT expiration to 4 or 8 hours instead of 24 hours to enforce re-authentication for inactive sessions.
4. **Login Brute-Force Hardening**:
   Explicitly apply `limiter.limit("5 per minute")` directly to the `/api/auth/login` route in `auth/routes.py` to prevent brute-force dictionary attacks against server passwords.
