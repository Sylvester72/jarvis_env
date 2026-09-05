"""VIRUS / SPYWARE SCAN
Uses Windows' own built-in Defender scanner rather than any custom scanning
logic - runs in the background so JARVIS stays responsive while it works."""

import os
import subprocess
import threading

from jarvis import tts
from jarvis.state import push_history


def run_virus_scan(quick=True):
    scan_type = "QuickScan" if quick else "FullScan"

    def _scan_worker():
        push_history(f"(starting a Windows Defender {scan_type} - this can take a while)")
        try:
            result = subprocess.run(
                ["powershell", "-Command", f"Start-MpScan -ScanType {scan_type}"],
                capture_output=True, text=True, timeout=3600,
            )
            if result.returncode == 0:
                push_history("(scan complete - no errors reported)")
                tts.speak("The scan is complete - all clear.")
            else:
                push_history(f"(scan finished with a warning: {result.stderr.strip()})")
                tts.speak("The scan turned something up. Windows Security has the details.")
        except Exception as e:
            push_history(f"(virus scan error: {e})")
            tts.speak("I couldn't run that scan, I'm afraid. You might try opening Windows Security directly.")

    threading.Thread(target=_scan_worker, daemon=True).start()
    kind = "quick" if quick else "full"
    return f"Starting a {kind} virus scan in the background. I'll let you know when it's done."


def open_windows_security():
    try:
        os.startfile("windowsdefender:")
        return "Opening Windows Security."
    except Exception as e:
        push_history(f"(windows security error: {e})")
        return "I couldn't open Windows Security."
