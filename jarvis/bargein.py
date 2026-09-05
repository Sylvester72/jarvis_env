"""Interruptible speech (barge-in).

While JARVIS is speaking, a lightweight mic monitor watches for sustained
speech. If the user starts talking, the current playback is stopped
immediately and the audio spoken by the user up to that moment is kept as a
pre-roll, so their command isn't clipped from its first word - the voice loop
prepends it to the fresh recording that follows.

The trigger is the same energy test the recorder uses (a chunk's mean
amplitude vs config.SILENCE_ENERGY_THRESHOLD); sustained speech just has to
hold for config.BARGE_IN_HANG_MS. Brief noises and single blips don't count.
"""

import threading

import numpy as np
import sounddevice as sd

from jarvis import config
from jarvis.state import push_history

_interrupted = threading.Event()
_preroll = []          # int16 (N, 1) frames captured from the start of the user's speech
_preroll_lock = threading.Lock()


def was_interrupted():
    return _interrupted.is_set()


def clear_interrupt():
    """Reset the interrupt flag and any captured pre-roll. Called at the start
    of every speak() so the state only ever reflects the current utterance."""
    global _preroll
    _interrupted.clear()
    with _preroll_lock:
        _preroll = []


def pop_interrupt_audio():
    """Return the captured int16 mono frames (shape (N, 1)) from the start of
    the user's interruption, clearing the flag. Returns None if there's none."""
    global _preroll
    _interrupted.clear()
    with _preroll_lock:
        frames = _preroll
        _preroll = []
    if not frames:
        return None
    return np.concatenate(frames, axis=0)


def _chunk_energy(chunk):
    return float(np.abs(chunk.astype(np.float32)).mean())


class BargeInMonitor:
    """A mic monitor that runs while audio is playing. Created stopped; call
    start() just before playback begins so the user's interruption window
    matches the actual output, then stop() to close the stream when done."""

    def __init__(self, stop_playback):
        self._stop_playback = stop_playback
        self._stop = threading.Event()
        self._thread = None

    def start(self):
        if self._thread is None:
            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2)

    def _run(self):
        chunk_samples = int(config.SAMPLE_RATE * config.CHUNK_MS / 1000)
        hang_chunks = max(1, int(config.BARGE_IN_HANG_MS / config.CHUNK_MS))
        speech_run = 0
        pre_roll = []

        stream = sd.InputStream(samplerate=config.SAMPLE_RATE, channels=1, dtype="int16")
        stream.start()
        try:
            while not self._stop.is_set():
                chunk, _ = stream.read(chunk_samples)
                if _chunk_energy(chunk) > config.SILENCE_ENERGY_THRESHOLD:
                    speech_run += 1
                    pre_roll.append(chunk.copy())
                    if speech_run >= hang_chunks:
                        # sustained speech - the user is talking over JARVIS
                        global _preroll
                        with _preroll_lock:
                            _preroll = list(pre_roll)
                        _interrupted.set()
                        try:
                            self._stop_playback()
                        except Exception as e:
                            push_history(f"(barge-in stop error: {e})")
                        break
                else:
                    speech_run = 0
                    pre_roll = []
        except Exception as e:
            push_history(f"(barge-in monitor error: {e})")
        finally:
            try:
                stream.stop()
            except Exception:
                pass
            try:
                stream.close()
            except Exception:
                pass
