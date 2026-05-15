
import docker
import os

def debug_ollama():
    try:
        client = docker.from_env()
        container = client.containers.get("ollama")
        print(f"Ollama Status: {container.status}")
        print(f"Ollama Config (NetworkMode): {container.attrs['HostConfig']['NetworkMode']}")
        
        # Check logs
        logs = container.logs(tail=20).decode('utf-8')
        print("--- LAST 20 LOG LINES ---")
        print(logs)
        
        # Check IP
        print(f"IP Address: {container.attrs['NetworkSettings']['IPAddress']}")
        
    except Exception as e:
        print(f"Error debugging Ollama: {e}")

if __name__ == "__main__":
    debug_ollama()
