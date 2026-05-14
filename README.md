# EasyLin — Linux Server Management Dashboard

EasyLin is a modern, lightweight, and premium web-based dashboard designed to manage Linux servers directly from a Docker container with host-level access.

## 🚀 Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/edop78/easylin.git
   cd easylin
   ```

2. **Deploy with Docker Compose**:
   ```bash
   sudo docker compose up -d --build
   ```

3. **Access the Dashboard**:
   Open your browser and go to `http://YOUR_SERVER_IP:5050`

---

## ⚠️ Important: Lessons Learned & What to Avoid

During development, we identified several critical areas that can cause the application to crash or become inaccessible. Please follow these guidelines:

### 1. Protocol: HTTP vs HTTPS
*   **The Problem**: Accessing the dashboard via `https://` on port 5050 will result in an `SSL_ERROR_RX_RECORD_TOO_LONG` error.
*   **The Rule**: The internal Flask server is **HTTP only** by default. Always use `http://[IP]:5050`. If you need HTTPS, use a Reverse Proxy (like Nginx) in front of it.

### 2. Python Dependencies (Docker Environment)
*   **The Problem**: Adding new Python libraries (like `import docker`) without updating the `requirements.txt` or `Dockerfile` will prevent the Flask backend from starting.
*   **The Rule**: Prefer using `run_host_command()` to execute shell commands on the host rather than installing complex Python SDKs. It's more portable and less prone to environment crashes.

### 3. React Routing
*   **The Problem**: Mixing different types of Routers (e.g., `BrowserRouter` and `MemoryRouter`) or nesting them incorrectly causes a "White Screen of Death".
*   **The Rule**: Maintain a single Router wrapper. We use `BrowserRouter` for standard navigation. Avoid using `MemoryRouter` unless you specifically want to hide the URL path from the browser address bar.

### 4. Backend Module Imports
*   **The Problem**: Module loading in Flask can fail if the `PYTHONPATH` is not explicitly handled, leading to 404 errors or the server serving HTML instead of JSON.
*   **The Rule**: Always use robust import patterns in blueprints. The `app.py` is configured to automatically handle paths, but ensure modules are correctly registered in the `create_app()` factory.

### 5. Privileged Access
*   **The Problem**: Without proper permissions, the dashboard cannot monitor host services (SSH, UFW) or manage Docker containers.
*   **The Rule**: The container **must** run in `privileged: true` and `network_mode: host` to interact with the host's `systemctl` and network stack.

---

## 🛠 Tech Stack
*   **Backend**: Flask (Python 3.12), Psutil, JWT Auth.
*   **Frontend**: React 18, Vite, Lucide Icons, Vanilla CSS.
*   **Infrastructure**: Docker, Docker Compose, nsenter (for host access).

## 📄 License
This project is licensed under the MIT License.
