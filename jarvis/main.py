"""Entry point - wires configuration, memory, the voice thread, and the
dashboard together. Run with: python -m jarvis.main  (or python jarvis.py)."""

import threading
import tkinter as tk

from jarvis import ai
from jarvis import awareness
from jarvis import calendar
from jarvis import config
from jarvis import gui
from jarvis import memory
from jarvis import reminders
from jarvis import remote
from jarvis import routines
from jarvis import voice
from jarvis import weather


def main():
    import comtypes
    # Keep a COM apartment on the main thread (deliberately not uninitialized).
    # pycaw caches a COM enumerator module-wide; without a live apartment here,
    # releasing it during interpreter teardown can crash the process (segfault).
    comtypes.CoInitialize()

    config.ensure_data_dir()
    config.migrate_legacy_data()   # copy the old single-file data into data/ if present
    config.load_settings()
    memory.load_memory()
    reminders.load_reminders()
    calendar.load_calendar()
    routines.load_routines()
    weather.load_default_location()
    voice.load_voice_profile()
    if config.SILENCE_ENERGY_AUTO_CALIBRATE:
        voice.calibrate_silence_threshold()
    ai.update_system_prompt()      # bake in any facts loaded from previous sessions
    voice_thread = threading.Thread(target=voice.voice_loop, daemon=True)
    voice_thread.start()
    reminders.start_scheduler()    # fires pending reminders when their time comes
    awareness.start_monitor()      # speaks up about low battery / full disk
    awareness.run_startup_checks() # speaks up about Ollama / mic / internet
    remote.start_server()          # passcode-protected chat on the LAN only
    root = tk.Tk()
    gui.JarvisDashboard(root)
    root.mainloop()
    voice.stop_voice_loop(voice_thread)  # clean exit - no COM/audio teardown crash


if __name__ == "__main__":
    main()
