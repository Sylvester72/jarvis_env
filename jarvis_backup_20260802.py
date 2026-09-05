r"""
JARVIS - AI-powered voice assistant for Windows, with a dashboard GUI
------------------------------------------------
Features:
- Dashboard window: live status, volume level, command list, conversation history
- Wake word ("Jarvis"), then free-flowing conversation until you go quiet
- Fast fixed commands for real actions (apps, volume, time, search)
- Falls back to a local AI (Ollama) for open-ended conversation
- The AI is told exactly what it can/can't do, so it won't claim fake abilities

SETUP:
1. Install Ollama: https://ollama.com/download
2. In Command Prompt: ollama pull llama3.2
3. In your activated jarvis_env:
   pip install sounddevice numpy SpeechRecognition pyttsx3 pywin32 requests pycaw comtypes
4. python jarvis.py
   (Ollama must be running in the background - it auto-starts after install)

USAGE:
Say "Jarvis" and wait for "Yes?", then say your request, e.g.:
  "open notepad" / "mute" / "set volume to 50" / "what time is it" / "tell me a fun fact"
After that, keep talking without saying "Jarvis" again - it stays awake until
you go quiet for a while, or say "that's all" / "go to sleep" / "goodbye".
"""

import speech_recognition as sr
import pyttsx3
import datetime
import webbrowser
import subprocess
import os
import io
import wave
import re
import json
import ctypes
import random
import tempfile
import time
import asyncio
import threading
import queue
import tkinter as tk
from tkinter import scrolledtext

import numpy as np
import sounddevice as sd
import requests

try:
    from PIL import ImageGrab
except ImportError:
    ImageGrab = None  # screenshot command will explain it needs 'pip install pillow'

try:
    import win32com.client
except ImportError:
    win32com = None

try:
    import edge_tts
except ImportError:
    edge_tts = None  # falls back to offline voice if not installed

try:
    import pygame
except ImportError:
    pygame = None  # falls back to offline voice if not installed

try:
    from resemblyzer import VoiceEncoder, preprocess_wav
except ImportError:
    VoiceEncoder = None  # voice recognition commands will explain what's needed

try:
    import cv2
except ImportError:
    cv2 = None  # camera commands will explain it needs 'pip install opencv-python'

# ---------- SHARED STATE (thread-safe queue from voice thread -> GUI thread) ----------

gui_queue = queue.Queue()
stop_flag = threading.Event()


# ---------- PERSISTENT MEMORY (survives closing/reopening JARVIS) ----------

MEMORY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "jarvis_memory.json")
MAX_STORED_LOG_LINES = 300  # cap file size so it doesn't grow forever

FACTS = []  # things you've explicitly asked JARVIS to remember
LOG = []    # [timestamp, text] pairs for the conversation history panel


def load_memory():
    global FACTS, LOG
    if os.path.exists(MEMORY_PATH):
        try:
            with open(MEMORY_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                FACTS = data.get("facts", [])
                LOG = data.get("log", [])
        except Exception as e:
            print(f"(memory file couldn't be read, starting fresh: {e})")
            FACTS, LOG = [], []


def save_memory():
    try:
        with open(MEMORY_PATH, "w", encoding="utf-8") as f:
            json.dump({"facts": FACTS, "log": LOG[-MAX_STORED_LOG_LINES:]}, f, indent=2)
    except Exception as e:
        print(f"(memory save error: {e})")


# ---------- VOICE IDENTIFICATION (only respond to your voice) ----------
# Uses resemblyzer to turn a short clip of speech into a numeric "voice
# print" (an embedding), then compares new speech against your enrolled
# print with cosine similarity. This is approximate, not perfect - a
# similarity above VOICE_MATCH_THRESHOLD is treated as "probably you."

VOICE_PROFILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "jarvis_voice_profile.npy")
VOICE_MATCH_THRESHOLD = 0.6  # lower = more forgiving. Short words (yes/no/mute)
# produce less reliable voice prints than full sentences, so this is deliberately
# lenient. Raise it (e.g. toward 0.75) only if strangers are getting through.

voice_encoder = None       # loaded lazily once, inside the voice thread
ENROLLED_EMBEDDING = None  # your voice print, once enrolled


def load_voice_profile():
    global ENROLLED_EMBEDDING
    if os.path.exists(VOICE_PROFILE_PATH):
        try:
            ENROLLED_EMBEDDING = np.load(VOICE_PROFILE_PATH)
        except Exception as e:
            push_history(f"(voice profile couldn't be loaded: {e})")
            ENROLLED_EMBEDDING = None


def save_voice_profile(embedding):
    global ENROLLED_EMBEDDING
    ENROLLED_EMBEDDING = embedding
    try:
        np.save(VOICE_PROFILE_PATH, embedding)
    except Exception as e:
        push_history(f"(voice profile save error: {e})")


def _embed(waveform):
    wav = preprocess_wav(waveform, source_sr=SAMPLE_RATE)
    return voice_encoder.embed_utterance(wav)


def verify_speaker(waveform):
    """Returns True if this audio sounds like the enrolled voice, or if
    voice recognition isn't set up / available (fails open, not closed,
    so a bug here can't lock you out of your own assistant)."""
    if voice_encoder is None or ENROLLED_EMBEDDING is None:
        return True
    try:
        embedding = _embed(waveform)
        similarity = float(np.dot(embedding, ENROLLED_EMBEDDING))
        return similarity >= VOICE_MATCH_THRESHOLD
    except Exception as e:
        push_history(f"(voice verification error: {e})")
        return True


def enroll_voice():
    """Records a few samples of your voice and saves an averaged voice print."""
    if voice_encoder is None:
        speak("Voice recognition isn't installed. You'll need resemblyzer and torch for that.")
        return
    speak("Let's set up voice recognition. I'll record three short samples - "
          "just talk naturally each time, like you're talking to me.")
    embeddings = []
    for i in range(3):
        speak(f"Sample {i + 1}. Go ahead.")
        _, waveform, _ = record_audio(duration=4)
        try:
            embeddings.append(_embed(waveform))
        except Exception as e:
            push_history(f"(enrollment sample error: {e})")
    if len(embeddings) < 2:
        speak("That didn't go well, I couldn't get enough clean samples. Let's try again later.")
        return
    averaged = np.mean(embeddings, axis=0)
    averaged = averaged / np.linalg.norm(averaged)  # renormalize to a unit vector
    save_voice_profile(averaged)
    speak("Got it. I'll only respond to your voice from now on.")


def reset_voice_profile():
    global ENROLLED_EMBEDDING
    ENROLLED_EMBEDDING = None
    if os.path.exists(VOICE_PROFILE_PATH):
        try:
            os.remove(VOICE_PROFILE_PATH)
        except Exception as e:
            push_history(f"(voice profile delete error: {e})")
    speak("Voice recognition reset. I'll respond to anyone again now.")


def push_status(text):
    gui_queue.put(("status", text))


def push_history(text, save=True):
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    LOG.append([timestamp, text])
    gui_queue.put(("history", (timestamp, text)))
    if save:
        save_memory()


def push_volume(value):
    gui_queue.put(("volume", value))


# ---------- TTS / VOICE ----------
# Primary voice: a free online neural voice (Microsoft edge-tts) - much more
# natural-sounding, calm British male tone. Needs internet each time it speaks.
# Falls back automatically to the offline Windows voice if edge-tts/pygame
# aren't installed, or if there's no internet connection at the moment.

EDGE_VOICE = "en-GB-RyanNeural"  # calm, articulate British male voice

TTS_VOICE_INDEX = 1  # offline fallback: which system voice to use, if more than one
TTS_RATE = 175


def _speak_offline(text):
    try:
        local_engine = pyttsx3.init()
        local_engine.setProperty("rate", TTS_RATE)
        voices = local_engine.getProperty("voices")
        if len(voices) > TTS_VOICE_INDEX:
            local_engine.setProperty("voice", voices[TTS_VOICE_INDEX].id)
        local_engine.say(text)
        local_engine.runAndWait()
        local_engine.stop()
    except Exception as e:
        push_history(f"(offline text-to-speech error: {e})")


async def _edge_tts_save(text, path):
    communicate = edge_tts.Communicate(text, EDGE_VOICE)
    await communicate.save(path)


_mixer_ready = False


def _ensure_mixer():
    global _mixer_ready
    if not _mixer_ready:
        pygame.mixer.init()
        _mixer_ready = True


def _speak_online(text):
    path = os.path.join(tempfile.gettempdir(), "jarvis_speech.mp3")
    asyncio.run(_edge_tts_save(text, path))
    _ensure_mixer()
    pygame.mixer.music.load(path)
    pygame.mixer.music.play()
    while pygame.mixer.music.get_busy():
        time.sleep(0.1)
    pygame.mixer.music.unload()


def speak(text):
    push_history(f"JARVIS: {text}")
    push_status("Speaking...")

    if edge_tts is not None and pygame is not None:
        try:
            _speak_online(text)
            return
        except Exception as e:
            push_history(f"(online voice unavailable, using offline voice instead: {e})")

    _speak_offline(text)


OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "llama3.2"
VISION_MODEL = "llava"  # needs: ollama pull llava
SAMPLE_RATE = 16000
WAKE_WORDS = ("jarvis",)

# Tune these if responsiveness feels off:
# - Too many cutoffs mid-sentence -> raise SILENCE_ENERGY_THRESHOLD or SILENCE_HANG_MS
# - Feels slow to stop after you finish talking -> lower SILENCE_HANG_MS
SILENCE_ENERGY_THRESHOLD = 150   # int16 amplitude below this counts as "quiet"
SILENCE_HANG_MS = 700            # how much trailing silence ends the recording
CHUNK_MS = 100                   # size of each audio chunk while monitoring energy


def _chunk_energy(chunk):
    return float(np.abs(chunk.astype(np.float32)).mean())


def record_audio(duration=4):
    """Fixed-length recording - used for the passive wake-word check and
    voice enrollment, where a short, predictable window is what we want."""
    recording = sd.rec(
        int(duration * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype="int16"
    )
    sd.wait()
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(recording.tobytes())
    buffer.seek(0)
    waveform = recording.flatten().astype(np.float32) / 32768.0
    is_silent = _chunk_energy(recording) < SILENCE_ENERGY_THRESHOLD
    return buffer, waveform, is_silent


def record_until_silence(max_duration=8, min_duration=0.6):
    """Records starting immediately, and stops as soon as it detects you've
    finished talking - instead of always waiting the full max_duration.
    Used for actual commands, where responsiveness matters most."""
    chunk_samples = int(SAMPLE_RATE * CHUNK_MS / 1000)
    max_chunks = int((max_duration * 1000) / CHUNK_MS)
    min_chunks = int((min_duration * 1000) / CHUNK_MS)
    silence_chunks_needed = int(SILENCE_HANG_MS / CHUNK_MS)

    frames = []
    silence_run = 0
    speech_detected = False

    stream = sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16")
    stream.start()
    try:
        for i in range(max_chunks):
            chunk, _ = stream.read(chunk_samples)
            frames.append(chunk.copy())
            energy = _chunk_energy(chunk)
            if energy > SILENCE_ENERGY_THRESHOLD:
                speech_detected = True
                silence_run = 0
            elif speech_detected and i >= min_chunks:
                silence_run += 1
                if silence_run >= silence_chunks_needed:
                    break
    finally:
        stream.stop()
        stream.close()

    recording = np.concatenate(frames, axis=0) if frames else np.zeros((0, 1), dtype="int16")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(recording.tobytes())
    buffer.seek(0)
    waveform = recording.flatten().astype(np.float32) / 32768.0
    return buffer, waveform, not speech_detected


def transcribe(duration=4, quiet=False):
    """Fixed-length listen (for wake word detection). Returns (text, waveform).
    Skips the network call entirely if the recording was just silence, which
    is the common case while nothing's being said - saves a round trip."""
    audio_buffer, waveform, is_silent = record_audio(duration=duration)
    if is_silent:
        return "", waveform
    return _speech_to_text(audio_buffer, waveform, quiet)


def transcribe_dynamic(max_duration=8):
    """Stop-when-you-stop-talking listen (for actual commands)."""
    audio_buffer, waveform, is_silent = record_until_silence(max_duration=max_duration)
    if is_silent:
        return "", waveform
    return _speech_to_text(audio_buffer, waveform, quiet=False)


def _speech_to_text(audio_buffer, waveform, quiet):
    recognizer = sr.Recognizer()
    with sr.AudioFile(audio_buffer) as source:
        audio = recognizer.record(source)
    try:
        text = recognizer.recognize_google(audio)
        return text, waveform
    except sr.UnknownValueError:
        if not quiet:
            push_history("(heard audio, but couldn't make out any words)")
        return "", waveform
    except sr.RequestError as e:
        push_history(f"(speech recognition service error: {e})")
        return "", waveform
    except Exception as e:
        push_history(f"(connection hiccup: {e})")
        return "", waveform


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
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        filename = f"jarvis_screenshot_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        path = os.path.join(desktop, filename)
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


# ---------- VIRUS / SPYWARE SCAN ----------
# Uses Windows' own built-in Defender scanner rather than any custom scanning
# logic - runs in the background so JARVIS stays responsive while it works.

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
                speak("The scan is finished. No issues were reported.")
            else:
                push_history(f"(scan finished with a warning: {result.stderr.strip()})")
                speak("The scan finished, but something was flagged - check Windows Security for details.")
        except Exception as e:
            push_history(f"(virus scan error: {e})")
            speak("I couldn't run that scan. Try opening Windows Security directly.")

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


# ---------- CAMERA ----------

def take_photo():
    if cv2 is None:
        return "Camera capture needs the 'opencv-python' package - run: pip install opencv-python"
    try:
        cam = cv2.VideoCapture(0)
        ok, frame = cam.read()
        cam.release()
        if not ok:
            return "I couldn't access the camera - it may be in use by another app."
        filename = f"jarvis_photo_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        path = os.path.join(DESKTOP_PATH, filename)
        cv2.imwrite(path, frame)
        return f"Photo saved to Desktop as {filename}."
    except Exception as e:
        push_history(f"(camera error: {e})")
        return "I couldn't take a photo."


def open_camera_preview():
    """Opens a live camera preview window. Runs in its own thread so JARVIS
    keeps listening while the preview is up; press 'q' in the window to close it."""
    if cv2 is None:
        return "Camera preview needs the 'opencv-python' package - run: pip install opencv-python"

    def _preview_worker():
        cam = cv2.VideoCapture(0)
        if not cam.isOpened():
            push_history("(camera preview error: couldn't open the webcam)")
            return
        try:
            while True:
                ok, frame = cam.read()
                if not ok:
                    break
                cv2.imshow("JARVIS Camera (press 'q' to close)", frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        finally:
            cam.release()
            cv2.destroyAllWindows()
        push_history("(camera preview closed)")

    threading.Thread(target=_preview_worker, daemon=True).start()
    return "Opening the camera preview. Press Q in that window to close it."


# ---------- SCREEN VISION ----------
# Takes a screenshot and asks a local vision model (llava, via Ollama) to
# describe it. Runs as its own call since it needs a different model than
# regular conversation - kept separate from the main think()/conversation
# history so a big image doesn't bloat every future exchange.

def describe_screen():
    if ImageGrab is None:
        return "Screen vision needs the 'pillow' package - run: pip install pillow"
    try:
        import base64
        screenshot = ImageGrab.grab()
        buf = io.BytesIO()
        screenshot.save(buf, format="PNG")
        image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        response = requests.post(
            OLLAMA_URL,
            json={
                "model": VISION_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": "Briefly describe what's on this screen - what app or "
                                   "window is open, and anything notable. 2-3 sentences.",
                        "images": [image_b64],
                    }
                ],
                "stream": False,
            },
            timeout=60,
        )
        response.raise_for_status()
        return response.json()["message"]["content"]
    except requests.exceptions.ConnectionError:
        return "I can't reach my local AI brain. Is Ollama running?"
    except Exception as e:
        push_history(f"(screen vision error: {e})")
        return ("I couldn't analyze the screen. Make sure you've run "
                "'ollama pull llava' at least once.")


def describe_screen_async():
    def _vision_worker():
        push_status("Analyzing your screen...")
        result = describe_screen()
        speak(result)

    threading.Thread(target=_vision_worker, daemon=True).start()
    return "Let me take a look..."


try:
    import screen_brightness_control as sbc
except ImportError:
    sbc = None  # brightness command will explain it needs installing


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


# ---------- MEDIA KEYS (works with whatever app is currently playing) ----------

VK_MEDIA_PLAY_PAUSE = 0xB3
VK_MEDIA_NEXT_TRACK = 0xB0
VK_MEDIA_PREV_TRACK = 0xB1
KEYEVENTF_KEYUP = 0x0002


def _media_key(vk):
    ctypes.windll.user32.keybd_event(vk, 0, 0, 0)
    ctypes.windll.user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)


def media_play_pause():
    _media_key(VK_MEDIA_PLAY_PAUSE)
    return "Toggling playback."


def media_next():
    _media_key(VK_MEDIA_NEXT_TRACK)
    return "Skipping to the next track."


def media_prev():
    _media_key(VK_MEDIA_PREV_TRACK)
    return "Going back a track."


def set_brightness(percent):
    if sbc is None:
        return "Brightness control needs the 'screen-brightness-control' package - run: pip install screen-brightness-control"
    try:
        sbc.set_brightness(max(0, min(100, int(percent))))
        return f"Brightness set to {percent} percent."
    except Exception as e:
        push_history(f"(brightness error: {e})")
        return "I couldn't change the brightness."


# ---------- FILE ACTIONS (scoped to your Desktop, for safety) ----------
# JARVIS can only create/rename/delete things inside your Desktop folder -
# never anywhere else on the PC. This keeps a misheard filename from ever
# touching something important.

DESKTOP_PATH = os.path.join(os.path.expanduser("~"), "Desktop")


def create_file(name):
    path = os.path.join(DESKTOP_PATH, name)
    try:
        open(path, "a").close()
        return f"Created {name} on your Desktop."
    except Exception as e:
        push_history(f"(file create error: {e})")
        return f"I couldn't create {name}."


def create_folder(name):
    path = os.path.join(DESKTOP_PATH, name)
    try:
        os.makedirs(path, exist_ok=True)
        return f"Created the folder {name} on your Desktop."
    except Exception as e:
        push_history(f"(folder create error: {e})")
        return f"I couldn't create the folder {name}."


def rename_item(old_name, new_name):
    old_path = os.path.join(DESKTOP_PATH, old_name)
    new_path = os.path.join(DESKTOP_PATH, new_name)
    if not os.path.exists(old_path):
        return f"I can't find {old_name} on your Desktop."
    try:
        os.rename(old_path, new_path)
        return f"Renamed {old_name} to {new_name}."
    except Exception as e:
        push_history(f"(rename error: {e})")
        return f"I couldn't rename {old_name}."


def delete_item(name):
    path = os.path.join(DESKTOP_PATH, name)
    if not os.path.exists(path):
        return f"I can't find {name} on your Desktop."
    try:
        if os.path.isdir(path):
            import shutil
            shutil.rmtree(path)
        else:
            os.remove(path)
        return f"Deleted {name}."
    except Exception as e:
        push_history(f"(delete error: {e})")
        return f"I couldn't delete {name}."


# Tracks a pending destructive action awaiting a yes/no confirmation.
# 'arg' carries extra info the action needs, e.g. which file to delete.
PENDING_CONFIRM = {"action": None, "arg": None}

CONFIRM_WORDS = ("yes", "confirm", "do it", "go ahead", "sure", "alright", "all right", "yep", "yeah")
DENY_WORDS = ("no", "cancel", "nevermind", "never mind", "stop")


def execute_confirmed_action(action, arg=None):
    if action == "shutdown":
        os.system("shutdown /s /t 5")
        return "Shutting down in 5 seconds."
    if action == "restart":
        os.system("shutdown /r /t 5")
        return "Restarting in 5 seconds."
    if action == "delete":
        return delete_item(arg)
    return "Okay."


# ---------- FAST FIXED COMMANDS ----------

COMMAND_LIST = [
    "open notepad",
    "open calculator",
    "open task manager",
    "open file explorer",
    "open browser",
    "search for <something>",
    "mute / unmute",
    "set volume to <number>",
    "what time is it",
    "what's the date",
    "remember that <fact>",
    "what do you remember",
    "forget everything",
    "lock the computer",
    "open documents / downloads / desktop",
    "take a screenshot",
    "open settings / control panel",
    "show desktop",
    "empty recycle bin",
    "open command prompt",
    "shut down / restart / sleep the pc",
    "open spotify / discord / word / excel / steam...",
    "open youtube / gmail / reddit / github...",
    "pause / resume music, next / previous song",
    "set brightness to <number>",
    "create a file/folder called <name>",
    "rename <old name> to <new name>",
    "delete <name> (asks to confirm)",
    "learn my voice (one-time setup)",
    "forget my voice (disable recognition)",
    "scan for viruses / malware (quick or full)",
    "open windows security",
    "take a photo / picture",
    "open camera / camera preview",
    "what's on my screen (AI describes it)",
]


def try_fixed_command(command):
    c = command.lower()

    # ---- Destructive actions needing confirmation (checked first) ----
    if "cancel" in c and ("shutdown" in c or "shut down" in c or "restart" in c):
        os.system("shutdown /a")
        return "Cancelled the scheduled shutdown/restart."

    if "shut down" in c or "shutdown" in c or "power off" in c:
        PENDING_CONFIRM["action"] = "shutdown"
        return "Are you sure you want to shut down the PC? Say yes to confirm."

    if "restart" in c or "reboot" in c:
        PENDING_CONFIRM["action"] = "restart"
        return "Are you sure you want to restart the PC? Say yes to confirm."

    if c.startswith("delete "):
        name = command[len("delete "):].strip()
        if name:
            PENDING_CONFIRM["action"] = "delete"
            PENDING_CONFIRM["arg"] = name
            return f"Are you sure you want to delete {name} from your Desktop? Say yes to confirm."

    if "lock" in c and ("computer" in c or "pc" in c or "screen" in c):
        return lock_computer()

    if "scan" in c and ("virus" in c or "malware" in c or "spyware" in c):
        return run_virus_scan(quick=("full" not in c))

    if "windows security" in c or "windows defender" in c:
        return open_windows_security()

    if "photo" in c or "picture" in c:
        return take_photo()

    if "camera preview" in c or "show camera" in c or "camera feed" in c:
        return open_camera_preview()

    if "open camera" in c or "start camera" in c:
        return open_camera_preview()

    if "what's on my screen" in c or "what is on my screen" in c or "describe my screen" in c or "look at my screen" in c:
        return describe_screen_async()

    if "sleep" in c and ("computer" in c or "pc" in c or "system" in c):
        return sleep_computer()

    if "screenshot" in c:
        return take_screenshot()

    if "documents" in c:
        return open_folder("Documents")

    if "downloads" in c:
        return open_folder("Downloads")

    if "open desktop" in c or ("desktop" in c and "folder" in c):
        return open_folder("Desktop")

    if "show desktop" in c or "minimize" in c:
        return show_desktop()

    if "recycle bin" in c:
        return empty_recycle_bin()

    if "control panel" in c:
        os.startfile("control")
        return "Opening Control Panel."

    if "settings" in c:
        os.startfile("ms-settings:")
        return "Opening Settings."

    if "command prompt" in c or "cmd" in c:
        subprocess.Popen(["cmd.exe"])
        return "Opening Command Prompt."

    if "open notepad" in c:
        subprocess.Popen(["notepad.exe"])
        return "Opening Notepad."

    if "open calculator" in c:
        subprocess.Popen(["calc.exe"])
        return "Opening Calculator."

    if "manager" in c and ("task" in c or "tax" in c or "tusk" in c):
        try:
            os.startfile("taskmgr.exe")
        except OSError as e:
            push_history(f"(task manager error: {e})")
            return "I couldn't open Task Manager. You may need to run this as administrator."
        return "Opening Task Manager."

    if "explorer" in c or "open files" in c or "file explorer" in c:
        subprocess.Popen(["explorer.exe"])
        return "Opening File Explorer."

    if "open chrome" in c or "open browser" in c:
        webbrowser.open("https://www.google.com")
        return "Opening your browser."

    if "search for" in c:
        query = c.split("search for", 1)[1].strip()
        webbrowser.open(f"https://www.google.com/search?q={query}")
        return f"Searching for {query}."

    if "mute" in c and "unmute" not in c:
        return mute()

    if "unmute" in c:
        return unmute()

    if "volume" in c:
        match = re.search(r"(\d{1,3})", c)
        if match:
            return set_volume(match.group(1))
        if "up" in c:
            return set_volume(80)
        if "down" in c:
            return set_volume(20)
        if "max" in c:
            return set_volume(100)

    if "time" in c:
        return f"It's {datetime.datetime.now().strftime('%I:%M %p')}"

    if "date" in c or "what day" in c:
        return f"Today is {datetime.datetime.now().strftime('%B %d, %Y')}"

    # ---- Memory commands ----
    if c.startswith("remember that "):
        fact = command[len("remember that "):].strip()
    elif c.startswith("remember "):
        fact = command[len("remember "):].strip()
    else:
        fact = None
    if fact:
        FACTS.append(fact)
        save_memory()
        update_system_prompt()
        return f"Got it, I'll remember that {fact}."

    if "what do you remember" in c or "what do you know about me" in c:
        if FACTS:
            return "Here's what I remember: " + "; ".join(FACTS)
        return "I don't have anything stored about you yet."

    if "forget everything" in c or "clear your memory" in c or "forget what you know" in c:
        FACTS.clear()
        save_memory()
        update_system_prompt()
        return "Done, I've cleared everything I remembered."

    # ---- Named apps ----
    if "open" in c or "launch" in c or "start" in c:
        for app_name in APP_PATHS:
            if app_name in c:
                result = open_named_app(app_name)
                if result:
                    return result

    # ---- Web shortcuts ----
    for site_name, url in SITE_SHORTCUTS.items():
        if site_name in c:
            webbrowser.open(url)
            return f"Opening {site_name.title()}."

    # ---- Media controls ----
    if "pause" in c or "resume" in c or "play music" in c or "play song" in c or c.strip() == "play":
        return media_play_pause()

    if "next song" in c or "next track" in c or "skip song" in c or "skip track" in c:
        return media_next()

    if "previous song" in c or "previous track" in c or "last song" in c or "go back a song" in c:
        return media_prev()

    # ---- Brightness ----
    if "brightness" in c:
        match = re.search(r"(\d{1,3})", c)
        if match:
            return set_brightness(match.group(1))
        if "up" in c:
            return set_brightness(90)
        if "down" in c:
            return set_brightness(30)

    # ---- File actions (Desktop only) ----
    if c.startswith("create a file called ") or c.startswith("create file called "):
        name = command.split("called ", 1)[1].strip()
        return create_file(name)

    if c.startswith("create a folder called ") or c.startswith("create folder called "):
        name = command.split("called ", 1)[1].strip()
        return create_folder(name)

    rename_match = re.search(r"rename (.+) to (.+)", command, re.IGNORECASE)
    if rename_match:
        return rename_item(rename_match.group(1).strip(), rename_match.group(2).strip())

    return None  # no fixed command matched, fall through to the AI


ACTION_HINT_WORDS = (
    "open", "launch", "start", "close", "mute", "volume", "set volume",
    "lock", "screenshot", "shutdown", "shut down", "restart", "reboot",
    "sleep", "recycle bin", "show desktop", "minimize",
    "play", "pause", "resume", "skip", "brightness",
    "create a file", "create a folder", "rename", "delete",
    "scan", "photo", "picture", "camera", "screen",
)


def sounds_like_unmatched_action(command):
    c = command.lower()
    return any(word in c for word in ACTION_HINT_WORDS)


CAPABILITIES_TEXT = (
    "You can ONLY actually perform these actions on the PC (nothing else): "
    "open Notepad, open Calculator, open Task Manager, open File Explorer, "
    "open a web browser, search Google, mute/unmute/set system volume, "
    "tell the time or date, remember/recall/forget facts, lock the computer, "
    "open Documents/Downloads/Desktop folders, take a screenshot, open "
    "Settings or Control Panel, toggle show desktop, empty the recycle bin, "
    "open Command Prompt, shut down/restart/sleep the PC (with a "
    "confirmation step), open specific apps like Spotify/Discord/Word/Excel/"
    "Steam if their path is configured, open specific websites like YouTube/"
    "Gmail/Reddit/GitHub, control media playback (play/pause/next/previous - "
    "works on whatever app is currently playing), set screen brightness, and "
    "create/rename/delete files or folders on the Desktop only (delete asks "
    "for confirmation first), run a Windows Defender virus/malware scan, "
    "open Windows Security, take a photo or show a live preview from the "
    "webcam, and describe what's currently on screen using a vision model. "
    "You have NO "
    "ability to control smart home devices, set reminders, send messages, "
    "browse the web yourself, access the internet for live information, "
    "crack passwords, or decrypt/decode files you don't already have the "
    "key or password for - if asked to break encryption or bypass a "
    "password, decline and explain you don't do that, rather than "
    "pretending you can or attempting it. "
    "IMPORTANT: You are never the one who performs these actions directly - "
    "a separate part of the program handles them before you are even asked. "
    "If you are responding to a message, it means no action was taken, so "
    "NEVER say things like 'I've opened X' or 'X is now open'. Instead, "
    "just answer the question or explain you can't do that specific thing. "
    "You also do NOT know the real current date or time - if asked, say you "
    "don't have access to it rather than guessing or using a placeholder."
)

def build_system_content():
    content = (
        "You are JARVIS, a witty, warm, and genuinely helpful voice assistant "
        "running locally on the user's Windows PC - think of the AI from Iron Man: "
        "composed, a little dry-humored, clearly on the user's side. "
        "Talk like a real conversation, not a command-line tool: use contractions, "
        "vary your sentence openers, and occasionally ask a natural follow-up "
        "question if it fits (but don't force one into every reply). "
        "Since replies are read aloud, keep them tight - usually 1-3 sentences - "
        "but let yourself be a bit more expressive when the moment calls for it "
        "(e.g. reacting to something funny or surprising) rather than always "
        "being clipped. Avoid bullet points, lists, or anything that only makes "
        "sense written down. " + CAPABILITIES_TEXT
    )
    if FACTS:
        content += " Known facts you've been told to remember about the user: " + "; ".join(FACTS) + "."
    return content


conversation_history = [{"role": "system", "content": build_system_content()}]


def update_system_prompt():
    """Call this after FACTS changes so the AI's memory of you stays current."""
    conversation_history[0]["content"] = build_system_content()


MAX_HISTORY_MESSAGES = 16  # keep responses fast - trims old exchanges, keeps the system prompt


def _trim_history():
    # conversation_history[0] is always the system message - keep it, trim the rest
    if len(conversation_history) > MAX_HISTORY_MESSAGES + 1:
        del conversation_history[1:len(conversation_history) - MAX_HISTORY_MESSAGES]


def think(user_text):
    conversation_history.append({"role": "user", "content": user_text})
    _trim_history()
    try:
        response = requests.post(
            OLLAMA_URL,
            json={"model": MODEL, "messages": conversation_history, "stream": False},
            timeout=30,
        )
        response.raise_for_status()
        reply = response.json()["message"]["content"]
        conversation_history.append({"role": "assistant", "content": reply})
        return reply
    except requests.exceptions.ConnectionError:
        return "I can't reach my local AI brain. Is Ollama running?"
    except Exception as e:
        push_history(f"(Ollama error: {e})")
        return "Sorry, I had trouble thinking just now."


# ---------- MAIN VOICE LOOP (runs in a background thread) ----------

EXIT_PHRASES = ("goodbye", "exit", "quit", "bye", "shut down")
SLEEP_PHRASES = ("that's all", "go to sleep", "stop listening", "never mind", "nothing")
MAX_SILENT_TURNS = 2


def contains_wake_word(text):
    t = text.lower()
    return any(w in t for w in WAKE_WORDS)


def handle_command(command):
    """Process one command. Returns False if JARVIS should shut down entirely."""
    c = command.lower().strip()

    # If a destructive action is awaiting confirmation, this utterance must
    # answer that first, before anything else is processed.
    if PENDING_CONFIRM["action"]:
        action = PENDING_CONFIRM["action"]
        arg = PENDING_CONFIRM["arg"]
        PENDING_CONFIRM["action"] = None
        PENDING_CONFIRM["arg"] = None
        if any(word in c for word in CONFIRM_WORDS):
            speak(execute_confirmed_action(action, arg))
        else:
            speak("Okay, cancelled.")
        return True

    if c in EXIT_PHRASES:
        speak("Goodbye!")
        return False

    if "learn my voice" in c or "enroll my voice" in c or "train my voice" in c:
        enroll_voice()
        return True

    if "forget my voice" in c or "reset voice recognition" in c or "reset my voice" in c:
        reset_voice_profile()
        return True

    fixed_reply = try_fixed_command(command)
    if fixed_reply:
        speak(fixed_reply)
    elif sounds_like_unmatched_action(command):
        speak("I'm not set up to do that yet.")
    else:
        push_status("Thinking...")
        reply = think(command)
        speak(reply)
    return True


WAKE_ACKS = ("Yes?", "I'm here.", "Go ahead.", "What's up?", "Listening.")


def voice_loop():
    global voice_encoder
    import comtypes

    comtypes.CoInitialize()  # required for pycaw calls from this background thread

    if VoiceEncoder is not None and voice_encoder is None:
        push_history("(loading voice recognition model...)")
        try:
            voice_encoder = VoiceEncoder()
        except Exception as e:
            push_history(f"(couldn't load voice recognition model: {e})")

    push_history("JARVIS is running. Say 'Jarvis' to wake it up.")
    while not stop_flag.is_set():
        push_status("Sleeping (say 'Jarvis')")
        heard, wake_waveform = transcribe(duration=3, quiet=True)
        push_volume(get_volume_percent())
        if stop_flag.is_set():
            break
        if not heard or not contains_wake_word(heard):
            if heard:
                push_history(f"(heard, not a wake word: '{heard}')")
            continue

        if not verify_speaker(wake_waveform):
            push_history("(wake word heard, but the voice didn't match your profile - ignoring)")
            continue

        speak(random.choice(WAKE_ACKS))
        push_status("Listening for your command...")
        command, command_waveform = transcribe_dynamic(max_duration=8)
        if not command:
            push_history("(didn't catch anything, going back to sleep)")
            continue
        if not PENDING_CONFIRM["action"] and not verify_speaker(command_waveform):
            push_history(f"(command heard, but voice didn't match: '{command}' - ignoring)")
            continue
        push_history(f"You: {command}")

        if not handle_command(command):
            break

        # --- Conversation mode ---
        silent_turns = 0
        while silent_turns < MAX_SILENT_TURNS and not stop_flag.is_set():
            push_status("Listening (conversation mode)...")
            follow_up, follow_up_waveform = transcribe_dynamic(max_duration=8)
            if not follow_up:
                silent_turns += 1
                continue
            if not PENDING_CONFIRM["action"] and not verify_speaker(follow_up_waveform):
                push_history(f"(other voice heard, ignoring: '{follow_up}')")
                silent_turns += 1
                continue
            push_history(f"You: {follow_up}")

            if follow_up.lower().strip() in SLEEP_PHRASES:
                speak("Okay, let me know if you need anything.")
                break

            silent_turns = 0
            if not handle_command(follow_up):
                stop_flag.set()
                return

    push_status("Stopped")


# ---------- DASHBOARD GUI (Iron Man style HUD) ----------

BG = "#000d12"
PANEL_BG = "#001820"
CYAN = "#00e5ff"
CYAN_DIM = "#0a4f5c"
AMBER = "#ffb000"
GREEN = "#00ff9c"
RED = "#ff3b3b"
TEXT_DIM = "#5fa8b3"

STATE_COLORS = {
    "sleeping": CYAN_DIM,
    "listening": CYAN,
    "thinking": AMBER,
    "speaking": GREEN,
}


def classify_status(text):
    t = text.lower()
    if "listening" in t or "your command" in t:
        return "listening"
    if "thinking" in t:
        return "thinking"
    if "speaking" in t:
        return "speaking"
    return "sleeping"


class HUDCore(tk.Canvas):
    """Animated circular status core, like an arc reactor."""

    def __init__(self, parent, size=170, **kwargs):
        super().__init__(parent, width=size, height=size, bg=BG, highlightthickness=0, **kwargs)
        self.size = size
        self.angle = 0
        self.mode = "sleeping"
        self.pulse = 0
        self._animate()

    def set_mode(self, mode):
        self.mode = mode

    def _animate(self):
        self.delete("all")
        s = self.size
        cx = cy = s / 2
        color = STATE_COLORS.get(self.mode, CYAN_DIM)

        speed = {"sleeping": 1, "listening": 4, "thinking": 6, "speaking": 5}.get(self.mode, 1)
        self.angle = (self.angle + speed) % 360
        self.pulse = (self.pulse + 1) % 60
        pulse_r = 4 * abs(30 - self.pulse) / 30  # gentle breathing effect

        # Outer static ring
        self.create_oval(6, 6, s - 6, s - 6, outline=CYAN_DIM, width=2)

        # Rotating segmented arc ring
        for i in range(8):
            start = self.angle + i * 45
            extent = 20
            self.create_arc(
                16, 16, s - 16, s - 16, start=start, extent=extent,
                style="arc", outline=color, width=3,
            )

        # Inner glowing core
        inner_r = 28 + pulse_r
        self.create_oval(
            cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r,
            outline=color, width=2, fill=PANEL_BG,
        )
        self.create_oval(
            cx - inner_r + 10, cy - inner_r + 10, cx + inner_r - 10, cy + inner_r - 10,
            fill=color, outline="",
        )

        self.after(40, self._animate)


class BracketFrame(tk.Frame):
    """A frame with HUD-style corner brackets drawn around it."""

    def __init__(self, parent, title, **kwargs):
        super().__init__(parent, bg=BG, **kwargs)
        canvas = tk.Canvas(self, bg=BG, highlightthickness=0, height=18)
        canvas.pack(fill="x")
        self.bind("<Configure>", lambda e: self._draw_top(canvas, e))

        tk.Label(
            self, text=f"// {title}", font=("Consolas", 11, "bold"),
            fg=CYAN, bg=BG, anchor="w",
        ).pack(fill="x", padx=4)

        self.body = tk.Frame(self, bg=PANEL_BG, highlightbackground=CYAN_DIM, highlightthickness=1)
        self.body.pack(fill="both", expand=True, padx=2, pady=(2, 6))

    def _draw_top(self, canvas, event):
        canvas.delete("all")
        w = event.width
        L = 16
        canvas.create_line(0, 0, L, 0, fill=CYAN, width=2)
        canvas.create_line(0, 0, 0, 10, fill=CYAN, width=2)
        canvas.create_line(w, 0, w - L, 0, fill=CYAN, width=2)
        canvas.create_line(w, 0, w, 10, fill=CYAN, width=2)


class JarvisDashboard:
    def __init__(self, root):
        self.root = root
        root.title("J.A.R.V.I.S.")
        root.geometry("880x580")
        root.configure(bg=BG)

        # ---- Header ----
        header = tk.Frame(root, bg=BG)
        header.pack(fill="x", pady=(14, 0))
        tk.Label(
            header, text="J . A . R . V . I . S .", font=("Consolas", 22, "bold"),
            fg=CYAN, bg=BG,
        ).pack()
        tk.Label(
            header, text="PERSONAL ASSISTANT INTERFACE", font=("Consolas", 9),
            fg=TEXT_DIM, bg=BG,
        ).pack()

        # ---- Core status ring + text ----
        core_frame = tk.Frame(root, bg=BG)
        core_frame.pack(pady=10)
        self.core = HUDCore(core_frame)
        self.core.pack()

        self.status_var = tk.StringVar(value="INITIALIZING...")
        tk.Label(
            root, textvariable=self.status_var, font=("Consolas", 13, "bold"),
            fg=CYAN, bg=BG,
        ).pack()

        # ---- Volume gauge ----
        vol_frame = tk.Frame(root, bg=BG)
        vol_frame.pack(pady=(8, 4))
        tk.Label(vol_frame, text="VOL", font=("Consolas", 9), fg=TEXT_DIM, bg=BG).pack(side="left", padx=(0, 6))
        self.vol_canvas = tk.Canvas(vol_frame, width=220, height=14, bg=BG, highlightthickness=0)
        self.vol_canvas.pack(side="left")
        self.vol_label = tk.Label(vol_frame, text="--", font=("Consolas", 9), fg=TEXT_DIM, bg=BG)
        self.vol_label.pack(side="left", padx=(6, 0))

        # ---- Main panels ----
        main_frame = tk.Frame(root, bg=BG)
        main_frame.pack(fill="both", expand=True, padx=16, pady=(10, 6))

        left_panel = BracketFrame(main_frame, "COMMAND REGISTRY", width=260)
        left_panel.pack(side="left", fill="y", padx=(0, 12))
        left_panel.pack_propagate(False)
        cmd_box = tk.Listbox(
            left_panel.body, bg=PANEL_BG, fg=CYAN, selectbackground=CYAN_DIM,
            borderwidth=0, highlightthickness=0, font=("Consolas", 10),
            activestyle="none",
        )
        for cmd in COMMAND_LIST:
            cmd_box.insert("end", f"> {cmd}")
        cmd_box.pack(fill="both", expand=True, padx=6, pady=6)

        right_panel = BracketFrame(main_frame, "SYSTEM LOG")
        right_panel.pack(side="left", fill="both", expand=True)
        self.history_box = scrolledtext.ScrolledText(
            right_panel.body, bg=PANEL_BG, fg=CYAN, wrap="word",
            borderwidth=0, highlightthickness=0, font=("Consolas", 10),
            insertbackground=CYAN,
        )
        self.history_box.pack(fill="both", expand=True, padx=6, pady=6)
        self.history_box.configure(state="disabled")
        self.history_box.tag_configure("dim", foreground=TEXT_DIM)
        self.history_box.tag_configure("user", foreground="#ffffff")
        self.history_box.tag_configure("jarvis", foreground=CYAN)

        # Load conversation log saved from previous sessions, if any
        if LOG:
            self._insert_line("-- previous session --", "dim")
            for timestamp, text in LOG:
                self._insert_line(text, self._tag_for(text), timestamp)
            self._insert_line("-- current session --", "dim")

        # ---- Footer ----
        tk.Button(
            root, text="◉  DISCONNECT", command=self.quit, bg="#2a0a0a", fg=RED,
            activebackground="#3a0f0f", activeforeground=RED,
            font=("Consolas", 10, "bold"), borderwidth=0, pady=8,
            highlightbackground=RED, highlightthickness=1,
        ).pack(fill="x", padx=16, pady=(0, 14))

        root.protocol("WM_DELETE_WINDOW", self.quit)
        self.poll_queue()

    def _tag_for(self, text):
        if text.startswith("JARVIS:"):
            return "jarvis"
        if text.startswith("You:"):
            return "user"
        return "dim"

    def _insert_line(self, text, tag, timestamp=None):
        timestamp = timestamp or datetime.datetime.now().strftime("%H:%M:%S")
        self.history_box.configure(state="normal")
        self.history_box.insert("end", f"[{timestamp}] ", "dim")
        self.history_box.insert("end", f"{text}\n", tag)
        self.history_box.see("end")
        self.history_box.configure(state="disabled")

    def _draw_volume(self, percent):
        self.vol_canvas.delete("all")
        segments = 20
        filled = 0 if percent is None else round((percent / 100) * segments)
        for i in range(segments):
            x0 = i * 11
            color = CYAN if i < filled else CYAN_DIM
            self.vol_canvas.create_rectangle(x0, 2, x0 + 8, 12, fill=color, outline="")
        self.vol_label.config(text="--" if percent is None else f"{percent}%")

    def poll_queue(self):
        try:
            while True:
                kind, value = gui_queue.get_nowait()
                if kind == "status":
                    self.status_var.set(value.upper())
                    self.core.set_mode(classify_status(value))
                elif kind == "volume":
                    self._draw_volume(value)
                elif kind == "history":
                    timestamp, text = value
                    self._insert_line(text, self._tag_for(text), timestamp)
        except queue.Empty:
            pass
        if not stop_flag.is_set():
            self.root.after(150, self.poll_queue)

    def quit(self):
        stop_flag.set()
        push_status("Shutting down...")
        self.root.after(500, self.root.destroy)


if __name__ == "__main__":
    load_memory()
    load_voice_profile()
    update_system_prompt()  # bake in any facts loaded from previous sessions
    threading.Thread(target=voice_loop, daemon=True).start()
    root = tk.Tk()
    app = JarvisDashboard(root)
    root.mainloop()
