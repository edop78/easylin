"""EasyLin configuration."""

import os


class Config:
    """Application configuration."""

    # Security
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me-at-all-costs")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24 hours
    
    # Database
    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # If in Docker, use the mounted volume at /app/data
    if os.path.exists("/app/data"):
        DATABASE_PATH = "/app/data/easylin.db"
    else:
        DATABASE_PATH = os.environ.get("DATABASE_PATH", os.path.join(PROJECT_ROOT, "easylin.db"))

    # Host filesystem mount point
    HOST_ROOT = os.environ.get("HOST_ROOT", "/host")

    # Running in Docker?
    IN_DOCKER = os.path.exists("/.dockerenv") or os.environ.get("IN_DOCKER") == "true"
