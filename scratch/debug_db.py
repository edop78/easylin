
import sqlite3
import json
import os

db_path = r"c:\Users\edo_p\OneDrive\Desktop\Antigravity PJ\EasyLin\easylin.db"

try:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # Check if table exists
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='task_status'")
    if not cur.fetchone():
        print("Table 'task_status' does NOT exist.")
    else:
        cur.execute("SELECT * FROM task_status")
        rows = cur.fetchall()
        print(f"Found {len(rows)} tasks in task_status table.")
        for row in rows:
            print(f"App: {row['app_id']} | Status: {row['status']} | Msg: {row['message']}")
            logs = json.loads(row['logs']) if row['logs'] else []
            print(f"  Logs ({len(logs)} lines):")
            for line in logs[-5:]:
                print(f"    {line}")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
