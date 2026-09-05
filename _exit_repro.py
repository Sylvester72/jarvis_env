"""Throwaway: run the full app for N seconds, auto-close, clean shutdown."""
import sys
import threading
import tkinter as tk

import comtypes
comtypes.CoInitialize()  # main-thread COM apartment, kept alive through teardown

from jarvis import ai, config, gui, memory, voice

config.ensure_data_dir()
config.migrate_legacy_data()
config.load_settings()
memory.load_memory()
voice.load_voice_profile()
voice.calibrate_silence_threshold()
ai.update_system_prompt()
voice_thread = threading.Thread(target=voice.voice_loop, daemon=True)
voice_thread.start()

root = tk.Tk()
dash = gui.JarvisDashboard(root)
root.after(int(sys.argv[1]) * 1000 if len(sys.argv) > 1 else 8000, dash.quit)
root.mainloop()
voice.stop_voice_loop(voice_thread)
print("quit() path complete; voice thread stopped")
