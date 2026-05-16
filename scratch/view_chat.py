import sqlite3
conn = sqlite3.connect('easylin.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()
res = conn.execute("SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 5").fetchall()
for r in res:
    print(dict(r))
conn.close()
