import os
import json
import sqlite3
from database import get_db

# Fail-safe file logging for terminal output
LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "install_log.txt")

GLOBAL_LOGS = {} # Cache logs in RAM to bypass SQLite writes during high-frequency lines

def update_task_db(app_id, status=None, message=None, error=None, log_entry=None, logs_list=None):
    """Update task status in DB and write to physical log file."""
    if log_entry:
        try:
            with open(LOG_FILE, "a") as f:
                f.write(f"{log_entry}\n")
        except:
            pass
            
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT status, message, error, logs FROM task_status WHERE app_id = ?", (app_id,))
        row = cur.fetchone()
        
        current_logs = []
        if row and row['logs']:
            try:
                current_logs = json.loads(row['logs'])
            except:
                pass
        
        if logs_list is not None:
            current_logs = logs_list
        elif log_entry:
            # Aggressive de-duplication: if identical to last line, ignore
            if current_logs and log_entry == current_logs[-1]:
                return
            
            # Layer-aware progress update
            is_progress = log_entry.startswith('[') and ']' in log_entry
            if is_progress:
                layer_tag = log_entry.split(']')[0] + ']'
                if current_logs and current_logs[-1].startswith(layer_tag):
                    current_logs[-1] = log_entry
                else:
                    current_logs.append(log_entry)
            else:
                if current_logs and log_entry == current_logs[-1]:
                    return
                current_logs.append(log_entry)
            
            if len(current_logs) > 100: # Limit to 100 lines
                current_logs.pop(0)
        
        new_status = status or (row['status'] if row else 'installing')
        new_message = message or (row['message'] if row else '')
        new_error = error or (row['error'] if row else None)
        
        conn.execute("""
            INSERT INTO task_status (app_id, status, message, error, logs, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(app_id) DO UPDATE SET
                status = excluded.status,
                message = excluded.message,
                error = excluded.error,
                logs = excluded.logs,
                updated_at = CURRENT_TIMESTAMP
        """, (app_id, new_status, new_message, new_error, json.dumps(current_logs)))
        conn.commit()
    finally:
        conn.close()

def get_tasks_db():
    """Get all tasks from DB."""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT app_id, status, message, error, logs FROM task_status")
        rows = cur.fetchall()
        tasks = {}
        for r in rows:
            try:
                logs_parsed = json.loads(r['logs']) if r['logs'] else []
            except:
                logs_parsed = []
            tasks[r['app_id']] = {
                "status": r['status'],
                "message": r['message'],
                "error": r['error'],
                "logs": logs_parsed
            }
        return tasks
    finally:
        conn.close()
