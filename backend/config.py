"""EasyLin configuration."""

import os


class Config:
    """Application configuration."""

    # Security
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me-at-all-costs")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24 hours
    
    # Database
    DATABASE_PATH = os.environ.get("DATABASE_PATH", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "easylin.db"))

    # Host filesystem mount point
    HOST_ROOT = os.environ.get("HOST_ROOT", "/host")

    # Running in Docker?
    IN_DOCKER = os.path.exists("/.dockerenv") or os.environ.get("IN_DOCKER") == "true"
