# EasyLin — Modern Linux Management Dashboard

EasyLin is a premium, lightweight, and secure web-based dashboard designed to manage Linux servers directly from a Docker container. It provides high-level control over system services, Docker resources, networking, and AI integration with a sleek, high-fidelity interface.

## ✨ v1.2.0 Features

-   **🤖 AI Manager**: Run local AI models (Qwen, Llama, Mistral) via **Ollama** integration. Private, secure, and entirely on your hardware.
-   **🐳 Docker Management**: Full control over containers, images, volumes, and networks.
-   **⚙️ Advanced Power Controls**: Schedule reboots, shutdowns, or recurring power actions (Cron). Real-time monitoring and cancellation of pending tasks.
-   **📊 Technical Telemetry**: Real-time monitoring of CPU temperature, core usage, active user sessions (SSH/Local), and NTP synchronization.
-   **🌐 Reverse Proxy**: Nginx management with automated SSL (Let's Encrypt/Certbot).
-   **🛡️ System Security**: UFW Firewall management and SSH status monitoring.
-   **📂 Storage & Files**: Visual Storage Manager and a powerful, high-fidelity File Manager.
-   **🔐 PAM Auth**: Login using your existing Linux system users (requires sudo privileges).

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

## 🧠 AI Integration (Ollama)

To use the AI features, you must have **Ollama** installed on your host system:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```
EasyLin will automatically detect Ollama and allow you to download and chat with models locally.

## 🛡️ Security Hardening

EasyLin is built with security in mind:
-   **Rate Limiting**: Protection against brute-force attacks on the login API.
-   **Security Headers**: Built-in Talisman integration for HSTS, XSS, and CSP protection.
-   **Host Isolation**: Uses `nsenter` for controlled host interaction.
-   **JWT Auth**: Stateless, secure authentication with 24h token rotation.

## ⚠️ Important Considerations

-   **Privileged Mode**: Required to interact with the host system (Docker, systemd, power controls).
-   **Sudo Users**: Only system users with sudo privileges can authenticate.
-   **HTTPS**: The internal server is HTTP. For remote access, use the built-in Reverse Proxy to enable SSL.

## 📄 License
MIT License.
