# EasyLin — Linux Management Dashboard

A modern, web-based Linux server management dashboard. Simplifies common administration tasks with an intuitive GUI.

## Features

- **Dashboard** — System overview (CPU, RAM, disk, uptime)
- **System** — Hostname, timezone, reboot/shutdown, updates
- **Packages** — Install/remove packages (apt)
- **Users & Groups** — Manage system users and groups
- **Services** — Manage systemd services
- **Docker** — Containers, images, volumes, networks
- **Network** — Interfaces, IP configuration, DNS
- **Firewall** — UFW rules management
- **Reverse Proxy** — Nginx proxy configuration
- **File Manager** — Browse and edit files
- **Terminal** — Web-based command execution
- **Logs** — System log viewer

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/easylin.git
cd easylin
cp .env.example .env
# Edit .env and set a strong SECRET_KEY
docker compose up -d
```

Access the dashboard at `http://your-server-ip:5050`

Login with any system user that has sudo privileges.

## Requirements

- Docker & Docker Compose
- Debian/Ubuntu host system

## Architecture

- **Backend**: Python / Flask
- **Frontend**: React / Vite
- **Database**: SQLite (app config only)
- **Auth**: Linux system user authentication

## Development

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py

# Frontend
cd frontend
npm install
npm run dev
```

## License

MIT
