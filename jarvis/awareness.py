"""Proactive awareness: JARVIS watches system health in the background and
speaks up unprompted when something crosses a threshold - battery running low,
the main drive running out of space, or a service it depends on being down
(Ollama not reachable, no microphone, no internet). The service checks also run
once at startup, so a missing prerequisite is announced rather than failing
silently later. It uses the same speak()/push_history() as everything else; the
only difference is it's triggered by a timer (or startup) instead of a spoken
command.

Each alert is reported once, then stays silent while the condition holds, and
only speaks again after the condition clears and re-triggers - so it doesn't
nag on every cycle. Battery is handled gracefully: psutil.sensors_battery()
returns None on desktops without a battery, and that's simply skipped.
"""

import os
import socket
import threading

import psutil
import requests

from jarvis import config
from jarvis import persona
from jarvis import tts
from jarvis.state import push_history, stop_flag

_active = set()            # conditions currently tripped, so we don't re-announce
_lock = threading.Lock()
_monitor_started = False


def start_monitor():
    """Launch the background health-check thread. Idempotent; must be called
    from main() after the data dir is ready."""
    global _monitor_started
    if _monitor_started or not config.AWARENESS_ENABLED:
        return
    _monitor_started = True
    threading.Thread(target=_monitor_loop, daemon=True).start()


def run_startup_checks():
    """Speak about any startup problems (Ollama down, no microphone, no
    internet) instead of failing silently later. Runs in a background thread so
    it never delays the dashboard, and waits a moment for the voice loop and
    TTS to be ready first."""
    if not config.AWARENESS_ENABLED:
        return

    def _worker():
        stop_flag.wait(4)  # let the voice loop / GUI settle before speaking
        if stop_flag.is_set():
            return
        try:
            check_service_health()
        except Exception as e:
            push_history(f"(startup health check error: {e})")

    threading.Thread(target=_worker, daemon=True).start()


def _monitor_loop():
    while not stop_flag.is_set():
        try:
            check_health()
            check_service_health()
        except Exception as e:
            push_history(f"(health monitor error: {e})")
        # wait() also exits immediately when the assistant is stopping
        stop_flag.wait(config.HEALTH_CHECK_INTERVAL_SECONDS)


def _main_drive():
    """The drive JARVIS lives on (its C:/etc disk), where running out of space
    actually matters. Falls back to the working directory's drive if needed."""
    drive = os.path.splitdrive(config.PROJECT_ROOT)[0]
    if not drive:
        drive = os.path.splitdrive(os.getcwd())[0]
    return drive + os.sep if drive else "C:\\"


def check_health():
    """Run every watched condition and speak about any that just crossed a
    threshold. Returns the list of alerts spoken (used by tests)."""
    alerts = []
    battery = _check_battery()
    disk = _check_disk()
    if battery is not None:
        alerts.append(battery)
    if disk is not None:
        alerts.append(disk)
    return alerts


def check_service_health():
    """Run the service-level checks (Ollama reachable, microphone present,
    internet available) and speak about any that just failed. Returns the
    alerts spoken (used by tests)."""
    alerts = []
    for check in (_check_ollama, _check_mic, _check_internet):
        message = check()
        if message is not None:
            alerts.append(message)
    return alerts


# ---------- service checks (Ollama / microphone / internet) ----------
# Same trip-once-then-stand-quiet pattern as battery/disk. Each speaks a clear
# plain-language message when it first fails - never a stack trace or silence.

def _check_ollama():
    if not _ollama_reachable():
        return _tripped("ollama", persona.ALERT_OLLAMA_DOWN)
    _clear("ollama")
    return None


def _check_mic():
    if not _microphone_present():
        return _tripped("mic", persona.ALERT_MIC_MISSING)
    _clear("mic")
    return None


def _check_internet():
    if not _internet_available():
        return _tripped("internet", persona.ALERT_NO_INTERNET)
    _clear("internet")
    return None


def _ollama_reachable():
    """True if the local Ollama server answers its /api/tags health probe."""
    try:
        base = config.OLLAMA_URL.split("/api/", 1)[0]
        resp = requests.get(f"{base}/api/tags", timeout=2)
        resp.raise_for_status()
        return True
    except Exception:
        return False


def _microphone_present():
    """True if at least one audio input device is currently available."""
    try:
        import sounddevice as sd
        return any(d.get("max_input_channels", 0) > 0 for d in sd.query_devices())
    except Exception:
        return False


def _internet_available():
    """True if we can open a connection to a well-known host. A raw TCP connect
    avoids any TLS/antivirus interference and is fast to fail."""
    for host, port in (("8.8.8.8", 53), ("1.1.1.1", 443)):
        try:
            with socket.create_connection((host, port), timeout=2):
                return True
        except Exception:
            continue
    return False


def _check_battery():
    charge = None
    try:
        charge = psutil.sensors_battery()
    except Exception:
        return None
    if charge is None:
        return None  # desktop / no battery - nothing to watch
    percent = int(charge.percent)
    if percent <= config.BATTERY_LOW_PERCENT:
        return _tripped("battery", persona.ALERT_BATTERY.format(percent=percent))
    _clear("battery")
    return None


def _check_disk():
    try:
        usage = psutil.disk_usage(_main_drive())
    except Exception:
        return None
    if usage.total <= 0:
        return None
    free = round(usage.free / usage.total * 100)
    if free <= config.DISK_LOW_FREE_PERCENT:
        return _tripped("disk", persona.ALERT_DISK.format(free=free))
    _clear("disk")
    return None


def _tripped(key, message):
    """Speak the alert the first time a condition trips; return the message, or
    None if it's already been announced while still holding."""
    with _lock:
        if key in _active:
            return None
        _active.add(key)
    tts.speak(message)
    return message


def _clear(key):
    """Re-arm a condition so it can alert again if it later re-trips."""
    with _lock:
        _active.discard(key)