# EasyLin — Modern Linux Management Dashboard

EasyLin is a premium, lightweight, and secure web-based dashboard designed to manage Linux servers directly from a Docker container. It provides high-level control over system services, Docker resources, networking, and security with a sleek, high-fidelity interface.

## ✨ Core Features

-   **🐳 Docker Management**: Full control over containers, images, volumes, and networks.
-   **🌐 Reverse Proxy**: Nginx management with automated SSL (Let's Encrypt/Certbot).
-   **🛡️ System Security**: UFW Firewall management and SSH status monitoring.
-   **⚙️ Service Control**: Manage `systemd` services (start, stop, restart, logs) via host integration.
-   **🔐 PAM Auth**: Login using your existing Linux system users (requires sudo privileges).
-   **📊 System Monitoring**: Real-time stats for CPU, RAM, Disk, and Network.

## 🚀 Quick Start

The fastest way to get EasyLin running on your Ubuntu/Debian server:

```bash
wget -qO- https://raw.githubusercontent.com/edop78/easylin/main/install.sh | sudo bash
```

Alternatively, manual installation:

1.  **Clone**: `git clone https://github.com/edop78/easylin.git && cd easylin`
2.  **Env**: `cp .env.example .env` (and edit secrets)
3.  **Deploy**: `sudo docker compose up -d --build`
4.  **Access**: `http://YOUR_SERVER_IP:5050`

## 🛡️ Security Hardening

EasyLin is built with security in mind:
-   **Rate Limiting**: Protection against brute-force attacks on the login API.
-   **Security Headers**: Built-in Talisman integration for HSTS, CSP, and XSS protection.
-   **Host Isolation**: Uses `nsenter` for controlled host interaction rather than running everything in a shared namespace.
-   **JWT Auth**: Stateless, secure authentication with 24h token rotation.

## ⚠️ Important Considerations

### 1. Protocol: HTTP vs HTTPS
Access the dashboard via **HTTP** on port 5050.
-   **Rule**: The internal server is HTTP only. If you need HTTPS for the dashboard itself, use the built-in Reverse Proxy module to expose it securely via a domain.

### 2. Privileged Mode
EasyLin requires `privileged: true` and `pid: host` to interact with the host system (e.g., managing Docker or systemd services). This is standard for infrastructure management tools.

### 3. Permissions
Only users with **Sudo privileges** (members of `sudo`, `wheel`, or `root` groups) can log in to the dashboard.

## 🛠 Tech Stack
-   **Backend**: Flask (Python 3.12), Docker SDK, Psutil, JWT.
-   **Frontend**: React 18, Vite, Lucide Icons, Vanilla CSS (Premium Dark Theme).
-   **Infrastructure**: Docker Compose, Nginx, Certbot.

## 📄 License
MIT License.
