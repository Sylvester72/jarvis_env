"""Text-to-speech: a free online neural voice (Microsoft edge-tts), which is
much more natural-sounding, with automatic fallback to the offline Windows
voice (pyttsx3) if edge-tts/pygame aren't installed or the internet drops."""

import asyncio
import os
import tempfile
import time

import pyttsx3

try:
    import edge_tts
except ImportError:
    edge_tts = None  # falls back to offline voice if not installed

try:
    import pygame
except ImportError:
    pygame = None  # falls back to offline voice if not installed

from jarvis import bargein
from jarvis import config
from jarvis.state import push_history, push_status

_mixer_ready = False
_current_engine = None  # the pyttsx3 engine currently speaking, if any


def _stop_playback():
    """Stop whatever TTS is currently playing. Called by the barge-in monitor
    the moment the user starts talking over JARVIS."""
    if pygame is not None:
        try:
            pygame.mixer.music.stop()
        except Exception:
            pass
    if _current_engine is not None:
        try:
            _current_engine.stop()
        except Exception:
            pass


def _speak_offline(text, monitor):
    global _current_engine
    local_engine = None
    try:
        local_engine = pyttsx3.init()
        _current_engine = local_engine
        local_engine.setProperty("rate", config.TTS_RATE)
        voices = local_engine.getProperty("voices")
        if len(voices) > config.TTS_VOICE_INDEX:
            local_engine.setProperty("voice", voices[config.TTS_VOICE_INDEX].id)
        if monitor is not None:
            monitor.start()
        local_engine.say(text)
        local_engine.runAndWait()
    except Exception as e:
        push_history(f"(offline text-to-speech error: {e})")
    finally:
        _current_engine = None
        try:
            if local_engine is not None:
                local_engine.stop()
        except Exception:
            pass


async def _edge_tts_save(text, path):
    communicate = edge_tts.Communicate(text, config.EDGE_VOICE)
    await communicate.save(path)


def _ensure_mixer():
    global _mixer_ready
    if not _mixer_ready:
        pygame.mixer.init()
        _mixer_ready = True


def _speak_online(text, monitor):
    path = os.path.join(tempfile.gettempdir(), "jarvis_speech.mp3")
    asyncio.run(_edge_tts_save(text, path))
    _ensure_mixer()
    pygame.mixer.music.load(path)
    pygame.mixer.music.play()
    if monitor is not None:
        monitor.start()  # begin barge-in listening now that audio is actually playing
    while pygame.mixer.music.get_busy():
        time.sleep(0.1)
    pygame.mixer.music.unload()


def speak(text):
    push_history(f"JARVIS: {text}")
    push_status("Speaking...")

    # Watch for the user starting to talk over JARVIS. State is cleared first
    # so it only ever reflects an interruption of this utterance.
    bargein.clear_interrupt()
    monitor = bargein.BargeInMonitor(_stop_playback) if config.BARGE_IN_ENABLED else None
    try:
        if edge_tts is not None and pygame is not None:
            try:
                _speak_online(text, monitor)
                return bargein.was_interrupted()
            except Exception as e:
                push_history(f"(online voice unavailable, using offline voice instead: {e})")
        _speak_offline(text, monitor)
    finally:
        if monitor is not None:
            monitor.stop()
    return bargein.was_interrupted()
