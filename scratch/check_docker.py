
import docker
import os

def check():
    try:
        client = docker.from_env()
        info = client.info()
        print(f"Docker is UP. Version: {info.get('ServerVersion')}")
        containers = client.containers.list(all=True)
        print(f"Found {len(containers)} containers.")
        for c in containers:
            print(f" - {c.name}: {c.status}")
    except Exception as e:
        print(f"Docker connection FAILED: {e}")

if __name__ == "__main__":
    check()
