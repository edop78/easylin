import requests
import sqlite3
import os
import json

# Configuration
DB_PATH = "easylin.db"
OLLAMA_ENDPOINTS = [
    "http://127.0.0.1:11434/api",
    "http://localhost:11434/api",
    "http://host.docker.internal:11434/api"
]

def check_network():
    print("--- Network Diagnostics ---")
    for url in OLLAMA_ENDPOINTS:
        try:
            r = requests.get(f"{url}/tags", timeout=2.0)
            if r.status_code == 200:
                print(f"[SUCCESS] Ollama reachable at: {url}")
                models = r.json().get('models', [])
                print(f"Found {len(models)} models:")
                for m in models:
                    print(f"  - {m['name']} ({m['size']/(1024**3):.2f} GB)")
                return url
        except Exception as e:
            print(f"[FAILED] {url}: {e}")
    return None

def check_database():
    print("\n--- Database Diagnostics ---")
    if not os.path.exists(DB_PATH):
        print(f"[ERROR] Database file not found at {DB_PATH}")
        return
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        
        # Check tables
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row['name'] for row in cursor.fetchall()]
        print(f"Found tables: {', '.join(tables)}")
        
        if 'ai_permissions' in tables:
            cursor = conn.execute("SELECT capability, enabled FROM ai_permissions")
            perms = cursor.fetchall()
            print(f"Permissions configured: {len(perms)}")
            for p in perms:
                status = "ENABLED" if p['enabled'] else "DISABLED"
                print(f"  - {p['capability']}: {status}")
        else:
            print("[ERROR] ai_permissions table MISSING!")
            
        conn.close()
    except Exception as e:
        print(f"[ERROR] Database access failed: {e}")

def check_database():
    print("\n--- Database Diagnostics ---")
    # ... (omitted for brevity in this call but I'll replace the whole function)

def check_resources():
    print("\n--- Resource Diagnostics ---")
    try:
        import psutil
        vm = psutil.virtual_memory()
        print(f"Total RAM: {vm.total / (1024**3):.2f} GB")
        print(f"Available RAM: {vm.available / (1024**3):.2f} GB")
        print(f"Used RAM: {vm.percent}%")
        if vm.percent > 90:
            print("[WARNING] RAM usage is critical! This will make AI extremely slow.")
    except Exception as e:
        print(f"[ERROR] Could not check resources: {e}")

if __name__ == "__main__":
    active_url = check_network()
    check_resources()
    check_database()
    print("\nDiagnostic complete.")
