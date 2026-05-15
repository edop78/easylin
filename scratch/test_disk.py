
import os
import sys

log_file = r"c:\Users\edo_p\OneDrive\Desktop\Antigravity PJ\EasyLin\install_log.txt"
try:
    with open(log_file, "w") as f:
        f.write("DISK PERMISSION TEST SUCCESSFUL\n")
    print(f"Successfully created {log_file}")
except Exception as e:
    print(f"FAILED to create log file: {e}")
