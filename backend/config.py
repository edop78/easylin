"""EasyLin configuration."""

import os


class Config:
    """Application configuration."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    JWT_SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = 3600  # 1 hour
    JWT_TOKEN_LOCATION = ["headers", "cookies"]
    JWT_COOKIE_SECURE = False
    JWT_COOKIE_CSRF_PROTECT = False

    # Database
    DATABASE_PATH = os.environ.get("DATABASE_PATH", "/app/data/easylin.db")

    # Host filesystem mount point
    HOST_ROOT = os.environ.get("HOST_ROOT", "/host")

    # Running in Docker?
    IN_DOCKER = os.path.exists("/.dockerenv")
