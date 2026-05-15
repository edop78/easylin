# EasyLin — Modern Linux Management Dashboard

EasyLin is a premium, lightweight, and secure web-based dashboard designed to manage Linux servers directly from a Docker container. It provides high-level control over system services, Docker resources, networking, and AI integration with a sleek, high-fidelity, and **fully responsive** interface.

## ✨ v1.2.0 Features

-   **🤖 AI Manager**: Run local AI models (Qwen, Llama, Mistral) via **Ollama** integration. Now installable with one-click from the built-in App Store.
-   **🐳 Docker App Store**: One-click deployment for popular services like Ollama and Nginx Proxy Manager, with real-time log tracking.
-   **📂 LVM Storage Manager**: Visualize and **expand your root partition** directly from the UI. Perfect for Proxmox and virtualized environments.
-   **📱 Mobile Responsive**: A fluid, app-like experience optimized for smartphones, tablets, and desktops with a smart collapsible sidebar.
-   **⚙️ Advanced Power Controls**: Schedule reboots, shutdowns, or recurring power actions (Cron).
-   **📊 Technical Telemetry**: Real-time monitoring of CPU, RAM, and Disk storage with precision data.
-   **🌐 Reverse Proxy & Security**: Nginx management with SSL, UFW Firewall, and SSH monitoring.
-   **🔐 PAM Auth**: Login using your existing Linux system users.

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

EasyLin makes running local AI easier than ever. You no longer need to manually install Ollama on the host. Simply go to the **Docker App Store** section within EasyLin and click **Install** on the Ollama AI card. Once installed, the **AI Manager** will automatically activate, allowing you to download and chat with models.

## 🛡️ Security Hardening

EasyLin is built with security in mind:
-   **Rate Limiting**: Protection against brute-force attacks on the login API.
-   **Security Headers**: Built-in Talisman integration for HSTS, XSS, and CSP protection.
-   **Host Isolation**: Uses `nsenter` for controlled host interaction.
-   **JWT Auth**: Stateless, secure authentication with 24h token rotation.

## 📄 License
MIT License.
