"""Offline wake-word detection using openWakeWord.

Replaces the old approach of recording 3-second chunks and sending them to
Google's speech API just to check for the word "Jarvis". openWakeWord runs a
pretrained model (hey_jarvis) on-device over a continuous microphone stream,
with no network calls. Only after the wake word is actually detected do we
fall through to the normal (Google) speech-to-text for the command.

The audio captured around the trigger is returned to the caller so speaker
verification (resemblyzer) still runs on it, exactly as before.
"""

import collections
import os

import numpy as np
import sounddevice as sd

try:
    from openwakeword import Model
except ImportError:
    Model = None  # falls back to the legacy Google-based wake-word check

from jarvis import config
from jarvis.state import push_history, stop_flag

FRAME_SAMPLES = 1280       # 80 ms at 16 kHz - the model's expected input length
ROLLBACK_SECONDS = 1.8     # keep this much audio before the trigger, for speaker verification
_VOLUME_EVERY_FRAMES = 25  # ~2 s - how often to refresh the volume gauge while listening

_model = None
_load_attempted = False


def _resolvable_wake_models(names):
    """Decide what to hand to openWakeWord: configured model names that have a
    bundled model file, or absolute paths to custom .onnx models. Anything else
    is skipped with a note - openWakeWord raises on an unknown name, so a bad
    extra word must never take down the primary 'hey_jarvis' listener."""
    try:
        from openwakeword import get_pretrained_model_paths
        available = get_pretrained_model_paths("onnx")
    except Exception:
        available = []
    usable = []
    for item in names:
        if os.path.isfile(item) and item.lower().endswith(".onnx"):
            usable.append(item)  # a custom model file given as a path
            continue
        matched = None
        for path in available:
            if item.replace(" ", "_") in os.path.basename(path) and os.path.exists(path):
                matched = path
                break
        if matched is None:
            push_history(f"(wake word '{item}' has no model file - skipping)")
            continue
        usable.append(item)  # keep the name; openWakeWord resolves it to the file
    return usable


def get_wake_model():
    """Load the openWakeWord models (the primary plus any configured extras)
    once and return the combined listener. Returns None if the package isn't
    installed or nothing loadable is configured, in which case the caller falls
    back to the legacy Google-based wake-word check."""
    global _model, _load_attempted
    if _load_attempted:
        return _model
    _load_attempted = True
    if Model is None:
        push_history("(openwakeword not installed - using legacy wake-word detection)")
        return None
    try:
        models = _resolvable_wake_models(config.all_wake_models())
        if not models:
            push_history("(no openwakeword wake word models available - using legacy detection)")
            return None
        _model = Model(wakeword_models=models, inference_framework="onnx")
        push_history(f"(wake word models loaded: {', '.join(config.all_wake_models())})")
    except Exception as e:
        _model = None
        push_history(f"(wake word model failed to load, using legacy detection: {e})")
    return _model


def listen_for_wake_word(model, on_volume=None):
    """Continuously monitor the microphone for the wake word, on-device with
    no network. Blocks until the wake word is detected, returning the captured
    float32 waveform around the trigger (for speaker verification), or returns
    None if the stop flag fires first.

    `on_volume`, if given, is called periodically (~every 2 s) while listening
    so the dashboard volume gauge stays live. If the microphone stream or the
    model raises, the exception propagates to the caller, which falls back to
    legacy detection rather than hanging in silence.
    """
    rollback_chunks = max(1, int(ROLLBACK_SECONDS * config.SAMPLE_RATE / FRAME_SAMPLES))
    ring = collections.deque(maxlen=rollback_chunks)
    frames_until_volume = 0

    stream = sd.InputStream(
        samplerate=config.SAMPLE_RATE, channels=1, dtype="int16", blocksize=FRAME_SAMPLES
    )
    stream.start()
    try:
        while not stop_flag.is_set():
            chunk, _ = stream.read(FRAME_SAMPLES)
            frame = chunk[:, 0]  # mono
            ring.append(frame.copy())

            frames_until_volume += 1
            if on_volume is not None and frames_until_volume >= _VOLUME_EVERY_FRAMES:
                frames_until_volume = 0
                on_volume()

            # Multiple models can be loaded (primary + extras); any of them
            # crossing the threshold counts as the wake word.
            scores = model.predict(frame)
            best_name, best_score = max(scores.items(), key=lambda kv: kv[1]) if scores else (None, 0.0)
            if best_score >= config.WAKE_WORD_THRESHOLD:
                model.reset()  # clear internal buffers so the next trigger is fresh
                push_history(f"(wake word detected: {best_name})")
                return _assemble_waveform(ring)
    finally:
        stream.stop()
        stream.close()
    return None


def _assemble_waveform(ring):
    if not ring:
        return np.zeros((0,), dtype=np.float32)
    recording = np.concatenate(list(ring))
    return recording.astype(np.float32) / 32768.0
