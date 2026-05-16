import sqlite3
conn = sqlite3.connect('easylin.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
for table in tables:
    name = table['name']
    count = conn.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
    print(f"Table: {name}, Rows: {count}")
conn.close()
