"""SQLite database initialization and helpers."""

import sqlite3
import os
from config import Config

DB_PATH = Config.DATABASE_PATH


def get_db():
    """Get a database connection."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Initialize the database schema."""
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS proxy_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT NOT NULL,
            upstream_host TEXT NOT NULL,
            upstream_port INTEGER NOT NULL,
            ssl_enabled INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS task_status (
            app_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            message TEXT,
            error TEXT,
            logs TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ai_permissions (
            capability TEXT PRIMARY KEY,
            enabled INTEGER DEFAULT 0,
            description TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Seed initial permissions
        INSERT OR IGNORE INTO ai_permissions (capability, enabled, description) VALUES 
        ('system_info', 1, 'Read system metrics, OS version and hardware info'),
        ('docker_mgmt', 0, 'Start, stop and restart Docker containers'),
        ('file_read', 0, 'Read file contents from the system'),
        ('shell_exec', 0, 'CRITICAL: Execute arbitrary shell commands on the host'),
        ('network_view', 1, 'View network configuration and active connections');
    """)
    conn.commit()
    conn.close()
