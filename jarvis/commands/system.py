"""System-level actions: volume, brightness, power, folders, apps, web
shortcuts, and the small fixed-launch actions (notepad, calculator, ...)."""

import ctypes
import datetime
import os
import subprocess
import webbrowser

try:
    from PIL import ImageGrab
except ImportError:
    ImageGrab = None  # screenshot command will explain it needs 'pip install pillow'

try:
    import win32com.client
except ImportError:
    win32com = None

try:
    import screen_brightness_control as sbc
except ImportError:
    sbc = None  # brightness command will explain it needs installing

from jarvis import config
from jarvis.state import push_history


# ---------- VOLUME CONTROL (pycaw) ----------

def _get_volume_interface():
    from ctypes import cast, POINTER
    from comtypes import CLSCTX_ALL
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

    devices = AudioUtilities.GetSpeakers()
    interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    return cast(interface, POINTER(IAudioEndpointVolume))


_volume_error_logged = False


def get_volume_percent():
    global _volume_error_logged
    try:
        vol = _get_volume_interface()
        return round(vol.GetMasterVolumeLevelScalar() * 100)
    except Exception as e:
        if not _volume_error_logged:
            push_history(f"(volume monitor error: {e})")
            _volume_error_logged = True  # only log this once, not every poll
        return None


def set_volume(percent):
    try:
        percent = max(0, min(100, int(percent)))
        vol = _get_volume_interface()
        vol.SetMasterVolumeLevelScalar(percent / 100.0, None)
        return f"Volume set to {percent} percent."
    except Exception as e:
        push_history(f"(volume error: {e})")
        return "I couldn't change the volume."


def mute():
    try:
        _get_volume_interface().SetMute(1, None)
        return "Muted."
    except Exception as e:
        push_history(f"(volume error: {e})")
        return "I couldn't mute the volume."


def unmute():
    try:
        _get_volume_interface().SetMute(0, None)
        return "Unmuted."
    except Exception as e:
        push_history(f"(volume error: {e})")
        return "I couldn't unmute the volume."


# ---------- MORE SYSTEM ACTIONS ----------

def lock_computer():
    ctypes.windll.user32.LockWorkStation()
    return "Locking the computer."


def open_folder(name):
    path = os.path.join(os.path.expanduser("~"), name)
    if os.path.isdir(path):
        os.startfile(path)
        return f"Opening {name}."
    return f"I couldn't find your {name} folder."


def take_screenshot():
    if ImageGrab is None:
        return "Screenshots need the 'pillow' package - run: pip install pillow"
    try:
        filename = f"jarvis_screenshot_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        path = os.path.join(config.DESKTOP_PATH, filename)
        ImageGrab.grab().save(path)
        return f"Screenshot saved to Desktop as {filename}."
    except Exception as e:
        push_history(f"(screenshot error: {e})")
        return "I couldn't take a screenshot."


def show_desktop():
    if win32com is None:
        return "Showing the desktop needs the 'pywin32' package."
    try:
        shell = win32com.client.Dispatch("Shell.Application")
        shell.ToggleDesktop()
        return "Toggling the desktop view."
    except Exception as e:
        push_history(f"(show desktop error: {e})")
        return "I couldn't do that."


def empty_recycle_bin():
    try:
        # flags: 0x01 no confirm, 0x02 no progress UI, 0x04 no sound
        ctypes.windll.shell32.SHEmptyRecycleBinW(None, None, 0x01 | 0x02 | 0x04)
        return "Recycle bin emptied."
    except Exception as e:
        push_history(f"(recycle bin error: {e})")
        return "I couldn't empty the recycle bin."


def sleep_computer():
    ctypes.windll.powrprof.SetSuspendState(False, True, False)
    return "Going to sleep."


# ---------- SPECIFIC APPS ----------
# Fill in paths for anything else you want JARVIS to open. Common install
# locations are prefilled below, but yours may differ - right-click the
# app's shortcut > Properties > Target to find the real path if one fails.

APP_PATHS = {
    "spotify": os.path.expandvars(r"%APPDATA%\Spotify\Spotify.exe"),
    "discord": os.path.expandvars(r"%LOCALAPPDATA%\Discord\Update.exe --processStart Discord.exe"),
    "word": "winword.exe",
    "excel": "excel.exe",
    "powerpoint": "powerpnt.exe",
    "steam": r"C:\Program Files (x86)\Steam\steam.exe",
    "vs code": "code.exe",
}


def open_named_app(name):
    target = APP_PATHS.get(name)
    if not target:
        return None
    try:
        subprocess.Popen(target, shell=True)
        return f"Opening {name.title()}."
    except Exception as e:
        push_history(f"(app launch error for '{name}': {e})")
        return f"I couldn't open {name.title()}. The path in APP_PATHS may need fixing."


# ---------- WEB SHORTCUTS ----------

SITE_SHORTCUTS = {
    "youtube": "https://youtube.com",
    "gmail": "https://mail.google.com",
    "reddit": "https://reddit.com",
    "github": "https://github.com",
    "netflix": "https://netflix.com",
    "twitter": "https://twitter.com",
    "amazon": "https://amazon.com",
}


# ---------- SMALL FIXED LAUNCH ACTIONS ----------

def control_panel():
    os.startfile("control")
    return "Opening Control Panel."


def settings():
    os.startfile("ms-settings:")
    return "Opening Settings."


def command_prompt():
    subprocess.Popen(["cmd.exe"])
    return "Opening Command Prompt."


def notepad():
    subprocess.Popen(["notepad.exe"])
    return "Opening Notepad."


def calculator():
    subprocess.Popen(["calc.exe"])
    return "Opening Calculator."


def task_manager():
    try:
        os.startfile("taskmgr.exe")
    except OSError as e:
        push_history(f"(task manager error: {e})")
        return "I couldn't open Task Manager. You may need to run this as administrator."
    return "Opening Task Manager."


def explorer():
    subprocess.Popen(["explorer.exe"])
    return "Opening File Explorer."


def browser():
    webbrowser.open("https://www.google.com")
    return "Opening your browser."


def search(query):
    webbrowser.open(f"https://www.google.com/search?q={query}")
    return f"Searching for {query}."


def current_time():
    return f"It's {datetime.datetime.now().strftime('%I:%M %p')}"


def current_date():
    return f"Today is {datetime.datetime.now().strftime('%B %d, %Y')}"


def set_brightness(percent):
    if sbc is None:
        return "Brightness control needs the 'screen-brightness-control' package - run: pip install screen-brightness-control"
    try:
        sbc.set_brightness(max(0, min(100, int(percent))))
        return f"Brightness set to {percent} percent."
    except Exception as e:
        push_history(f"(brightness error: {e})")
        return "I couldn't change the brightness."
