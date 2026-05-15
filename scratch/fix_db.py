
import sqlite3
import os
import json

def diagnose():
    root_dir = r"c:\Users\edo_p\OneDrive\Desktop\Antigravity PJ\EasyLin"
    db_path = os.path.join(root_dir, "easylin.db")
    
    print(f"--- DIAGNOSTIC START ---")
    print(f"Checking DB at: {db_path}")
    
    if not os.path.exists(db_path):
        print("DB file missing! Creating empty file...")
        open(db_path, 'a').close()
    
    try:
        conn = sqlite3.connect(db_path)
        conn.execute("PRAGMA journal_mode=WAL")
        
        # Create table if missing
        conn.execute("""
            CREATE TABLE IF NOT EXISTS task_status (
                app_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                message TEXT,
                error TEXT,
                logs TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert a dummy entry for Ollama to test visibility
        test_logs = json.dumps([
            "> SYSTEM DIAGNOSTIC: Database link established.",
            "> SYSTEM DIAGNOSTIC: Terminal ready for input.",
            "> SYSTEM DIAGNOSTIC: Backend process authorized."
        ])
        
        conn.execute("""
            INSERT INTO task_status (app_id, status, message, logs)
            VALUES ('ollama', 'installing', 'Diagnostic Active', ?)
            ON CONFLICT(app_id) DO UPDATE SET
                status = excluded.status,
                message = excluded.message,
                logs = excluded.logs,
                updated_at = CURRENT_TIMESTAMP
        """, (test_logs,))
        
        conn.commit()
        print("Database initialized and test record inserted successfully.")
        
        # Check current state
        cur = conn.cursor()
        cur.execute("SELECT * FROM task_status WHERE app_id = 'ollama'")
        row = cur.fetchone()
        if row:
            print(f"Verified record in DB: {row[0]} | {row[1]} | {row[2]}")
        
        conn.close()
    except Exception as e:
        print(f"CRITICAL ERROR during diagnosis: {e}")

if __name__ == "__main__":
    diagnose()
