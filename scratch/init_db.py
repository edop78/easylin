import sys
import os

# Add the project root to sys.path to import backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

from database import init_db

if __name__ == "__main__":
    print("Initializing database...")
    init_db()
    print("Done.")
