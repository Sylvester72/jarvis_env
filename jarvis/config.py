"""Mutable configuration and runtime paths.

Tunables live here as module attributes so the dashboard settings panel and
the startup auto-calibration can change them at runtime. Always read them as
``config.NAME`` at the call site - never ``from config import NAME`` - or a
later change to the value won't be visible.
"""

import json
import os
import shutil

# ---- data directory (created at runtime; memory/voice profile live here) ----
PACKAGE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(PACKAGE_DIR)
DATA_DIR = os.path.join(PACKAGE_DIR, "data")
MEMORY_PATH = os.path.join(DATA_DIR, "memory.json")
VOICE_PROFILE_PATH = os.path.join(DATA_DIR, "voice_profile.npy")

# ---- tunables (defaults mirror the original single-file constants) ----
SAMPLE_RATE = 16000              # audio sample rate used across recording and wake word
SILENCE_ENERGY_THRESHOLD = 150   # int16 amplitude below this counts as "quiet"
SILENCE_ENERGY_AUTO_CALIBRATE = True  # re-measure against ambient noise at startup
SILENCE_HANG_MS = 700            # how much trailing silence ends the recording
CHUNK_MS = 100                   # size of each audio chunk while monitoring energy
VOICE_MATCH_THRESHOLD = 0.6      # lower = more forgiving
# ---- offline wake word (openWakeWord) ----
WAKE_MODEL = "hey_jarvis"        # primary pretrained on-device model; always runs
EXTRA_WAKE_WORDS = []            # optional extra wake words, opt-in via
                                 # settings.json ("extra_wake_words"). Each entry
                                 # is an openWakeWord model name (alexa,
                                 # hey_mycroft, hey_jarvis, hey_rhasspy, timer,
                                 # weather) that has a matching model file, OR a
                                 # path to a custom .onnx model. "hey_jarvis"
                                 # stays the primary; an entry with no available
                                 # model file is skipped (never breaks the rest).
WAKE_WORD_THRESHOLD = 0.5        # model score above this counts as the wake word detected
# ---- interruptible speech (barge-in) ----
BARGE_IN_ENABLED = True          # stop TTS and listen when the user starts talking over it
BARGE_IN_HANG_MS = 350           # sustained speech this long interrupts playback (reuses the
                                 # same SILENCE_ENERGY_THRESHOLD energy test)
# ---- proactive awareness (background health checks) ----
AWARENESS_ENABLED = True         # speak up unprompted about battery / disk issues
HEALTH_CHECK_INTERVAL_SECONDS = 300  # how often the background health check runs (5 min)
BATTERY_LOW_PERCENT = 15         # at or below this charge %, mention the battery once
DISK_LOW_FREE_PERCENT = 10       # at or below this % free on the main drive, mention it once
# ---- remote access (local network only, passcode-protected) ----
REMOTE_ENABLED = True            # serve a phone-friendly chat on your LAN only
REMOTE_PORT = 8210
# ---- internet (weather/news) ----
ALLOW_UNVERIFIED_HTTPS_FALLBACK = True  # retry HTTPS requests unverified if the
                                        # antivirus CA is blocking verification (see jarvis/net.py)
EDGE_VOICE = "en-GB-RyanNeural"  # calm, articulate British male voice
TTS_VOICE_INDEX = 1              # offline fallback: which system voice to use
TTS_RATE = 175
OLLAMA_URL = "http://localhost:11434/api/chat"
# The Ollama model used for conversation. Change it here, or from the settings
# panel (it's persisted to data/settings.json). Pick one you've pulled with:
#     ollama pull <model>
# Good upgrades from llama3.2 (see the settings panel for suggestions):
#   - qwen2.5:7b   better conversation quality, still CPU-friendly
#   - llama3.1:8b  stronger reasoning + memory, needs ~6GB RAM, slower on CPU
#   - gemma2:9b    excellent instruction following, large + slower on CPU
MODEL = "llama3.2"
VISION_MODEL = "llava"           # needs: ollama pull llava
DESKTOP_PATH = os.path.join(os.path.expanduser("~"), "Desktop")


def _settings_path():
    return os.path.join(DATA_DIR, "settings.json")


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def migrate_legacy_data():
    """Copy the old single-file data (jarvis_memory.json, jarvis_voice_profile.npy)
    into data/ on first run, leaving the originals untouched as a safety copy."""
    ensure_data_dir()
    legacy_pairs = (
        (os.path.join(PROJECT_ROOT, "jarvis_memory.json"), MEMORY_PATH),
        (os.path.join(PROJECT_ROOT, "jarvis_voice_profile.npy"), VOICE_PROFILE_PATH),
    )
    for legacy, new in legacy_pairs:
        if os.path.exists(legacy) and not os.path.exists(new):
            try:
                shutil.copy2(legacy, new)
            except OSError as e:
                print(f"(legacy data copy error: {e})")


# mapping of settings.json keys -> config attribute names
_SETTINGS_ATTRS = {
    "silence_energy_threshold": "SILENCE_ENERGY_THRESHOLD",
    "silence_hang_ms": "SILENCE_HANG_MS",
    "chunk_ms": "CHUNK_MS",
    "voice_match_threshold": "VOICE_MATCH_THRESHOLD",
    "edge_voice": "EDGE_VOICE",
    "tts_voice_index": "TTS_VOICE_INDEX",
    "tts_rate": "TTS_RATE",
    "model": "MODEL",
    "extra_wake_words": "EXTRA_WAKE_WORDS",
    "remote_enabled": "REMOTE_ENABLED",
    "remote_port": "REMOTE_PORT",
}


def all_wake_models():
    """Every openWakeWord model JARVIS should listen for: the primary always,
    plus any opt-in extras (deduped). Read this at the call site - it reflects
    live settings changes to EXTRA_WAKE_WORDS."""
    raw = EXTRA_WAKE_WORDS
    if isinstance(raw, str):  # guard against a mangled settings file
        raw = [raw]
    extras = [str(w).strip() for w in raw if str(w).strip()]
    seen = [WAKE_MODEL]
    for w in extras:
        if w != WAKE_MODEL and w not in seen:
            seen.append(w)
    return seen


def load_settings():
    """Apply persisted overrides from data/settings.json onto the tunables."""
    path = _settings_path()
    if not os.path.exists(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"(settings couldn't be read, using defaults: {e})")
        return
    for key, attr in _SETTINGS_ATTRS.items():
        if key in data and data[key] is not None:
            globals()[attr] = data[key]
    # A manually-pinned silence threshold means the user took over from auto-calibration.
    if data.get("silence_energy_threshold") is not None:
        globals()["SILENCE_ENERGY_AUTO_CALIBRATE"] = False
    # ...unless settings.json explicitly says auto-calibration is on again.
    if "silence_energy_auto_calibrate" in data:
        globals()["SILENCE_ENERGY_AUTO_CALIBRATE"] = bool(data["silence_energy_auto_calibrate"])


def save_settings():
    """Persist the current tunables to data/settings.json."""
    ensure_data_dir()
    data = {key: globals()[attr] for key, attr in _SETTINGS_ATTRS.items()}
    # While auto-calibration is on, don't pin whatever the last calibration measured -
    # otherwise it would read as a manual override on the next boot.
    data["silence_energy_auto_calibrate"] = SILENCE_ENERGY_AUTO_CALIBRATE
    if SILENCE_ENERGY_AUTO_CALIBRATE:
        data["silence_energy_threshold"] = None
    try:
        with open(_settings_path(), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"(settings save error: {e})")
