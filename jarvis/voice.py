"""Voice input pipeline: recording, silence-based transcription, wake word
detection, speaker verification, and the main wake -> command -> conversation
loop. Also owns the enrolled voice profile (resemblyzer)."""

import io
import os
import random
import wave

import numpy as np
import sounddevice as sd
import speech_recognition as sr

try:
    from resemblyzer import VoiceEncoder, preprocess_wav
except ImportError:
    VoiceEncoder = None  # voice recognition commands will explain what's needed

from jarvis import ai
from jarvis import bargein
from jarvis import config
from jarvis import persona
from jarvis import routines
from jarvis import tts
from jarvis import wakeword
from jarvis import weather
from jarvis.commands import dispatcher
from jarvis.commands.system import get_volume_percent
from jarvis.state import push_history, push_status, push_volume, stop_flag

SAMPLE_RATE = config.SAMPLE_RATE

# Spoken forms of the configured openWakeWord model names, for the legacy
# Google-STT wake check (used only when openWakeWord isn't available).
_MODEL_TO_SPOKEN = {
    "hey_jarvis": "jarvis",
    "hey_mycroft": "mycroft",
    "hey_rhasspy": "rhasspy",
    "hey_google": "google",
    "hey_mymo": "mymo",
}


def legacy_wake_words():
    """The spoken words the legacy STT wake check listens for, derived from
    config.all_wake_models() so extra wake words apply to both paths."""
    words = []
    for model_name in config.all_wake_models():
        spoken = _MODEL_TO_SPOKEN.get(model_name)
        if spoken is None:
            spoken = (model_name.replace("hey_", "").strip().lower()
                      or model_name.lower())
        words.append(spoken)
    return tuple(words)


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
    is_silent = _chunk_energy(recording) < config.SILENCE_ENERGY_THRESHOLD
    return buffer, waveform, is_silent


def record_until_silence(max_duration=8, min_duration=0.6, preroll=None):
    """Records starting immediately, and stops as soon as it detects you've
    finished speaking - instead of always waiting the full max_duration.
    Used for actual commands, where responsiveness matters most.

    `preroll` is optional int16 mono audio ((N, 1) ndarray) to prepend - used
    after a barge-in, so the start of the interruption isn't clipped off."""
    chunk_samples = int(SAMPLE_RATE * config.CHUNK_MS / 1000)
    max_chunks = int((max_duration * 1000) / config.CHUNK_MS)
    min_chunks = int((min_duration * 1000) / config.CHUNK_MS)
    silence_chunks_needed = int(config.SILENCE_HANG_MS / config.CHUNK_MS)

    frames = []
    if preroll is not None and len(preroll):
        frames.append(preroll)  # the user is already speaking - prepend their pre-roll
    silence_run = 0
    speech_detected = len(frames) > 0

    stream = sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16")
    stream.start()
    try:
        for i in range(max_chunks):
            chunk, _ = stream.read(chunk_samples)
            frames.append(chunk.copy())
            energy = _chunk_energy(chunk)
            if energy > config.SILENCE_ENERGY_THRESHOLD:
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


def transcribe_dynamic(max_duration=8, preroll=None):
    """Stop-when-you-stop-talking listen (for actual commands)."""
    audio_buffer, waveform, is_silent = record_until_silence(max_duration=max_duration, preroll=preroll)
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


def calibrate_silence_threshold():
    """Sample ~2s of ambient room noise at startup and set the silence energy
    threshold from it, instead of relying on a fixed magic number. Speech is
    typically well above a few times the ambient level, so threshold = 3x the
    measured mean, clamped to a sane range."""
    try:
        recording = sd.rec(int(2 * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype="int16")
        sd.wait()
        mean = _chunk_energy(recording)
    except Exception as e:
        push_history(f"(silence calibration failed, keeping current threshold: {e})")
        return
    config.SILENCE_ENERGY_THRESHOLD = max(30, min(600, int(mean * 3)))
    push_history(f"(silence threshold auto-calibrated to {config.SILENCE_ENERGY_THRESHOLD})")


# ---------- VOICE IDENTIFICATION (only respond to your voice) ----------
# Uses resemblyzer to turn a short clip of speech into a numeric "voice
# print" (an embedding), then compares new speech against your enrolled
# print with cosine similarity. This is approximate, not perfect - a
# similarity above config.VOICE_MATCH_THRESHOLD is treated as "probably you."

voice_encoder = None       # loaded lazily once, inside the voice thread
ENROLLED_EMBEDDING = None  # your voice print, once enrolled


def load_voice_profile():
    global ENROLLED_EMBEDDING
    if os.path.exists(config.VOICE_PROFILE_PATH):
        try:
            ENROLLED_EMBEDDING = np.load(config.VOICE_PROFILE_PATH)
        except Exception as e:
            push_history(f"(voice profile couldn't be loaded: {e})")
            ENROLLED_EMBEDDING = None


def save_voice_profile(embedding):
    global ENROLLED_EMBEDDING
    ENROLLED_EMBEDDING = embedding
    try:
        np.save(config.VOICE_PROFILE_PATH, embedding)
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
        return similarity >= config.VOICE_MATCH_THRESHOLD
    except Exception as e:
        push_history(f"(voice verification error: {e})")
        return True


def enroll_voice():
    """Records a few samples of your voice and saves an averaged voice print."""
    if voice_encoder is None:
        tts.speak(persona.ERR_VOICE_RECOGNITION_NOT_INSTALLED)
        return
    tts.speak(persona.ENROLL_INTRO)
    embeddings = []
    for i in range(3):
        tts.speak(persona.ENROLL_SAMPLE.format(n=i + 1))
        _, waveform, _ = record_audio(duration=4)
        try:
            embeddings.append(_embed(waveform))
        except Exception as e:
            push_history(f"(enrollment sample error: {e})")
    if len(embeddings) < 2:
        tts.speak(persona.ENROLL_FAIL)
        return
    averaged = np.mean(embeddings, axis=0)
    averaged = averaged / np.linalg.norm(averaged)  # renormalize to a unit vector
    save_voice_profile(averaged)
    tts.speak(persona.ENROLL_DONE)


def reset_voice_profile():
    global ENROLLED_EMBEDDING
    ENROLLED_EMBEDDING = None
    if os.path.exists(config.VOICE_PROFILE_PATH):
        try:
            os.remove(config.VOICE_PROFILE_PATH)
        except Exception as e:
            push_history(f"(voice profile delete error: {e})")
    tts.speak(persona.RESET_DONE)


# ---------- MAIN VOICE LOOP (runs in a background thread) ----------

EXIT_PHRASES = ("goodbye", "exit", "quit", "bye", "shut down")
SLEEP_PHRASES = ("that's all", "go to sleep", "stop listening", "never mind", "nothing")
MAX_SILENT_TURNS = 2


def contains_wake_word(text):
    t = text.lower()
    return any(w in t for w in legacy_wake_words())


def _pending_preroll():
    """If the last speak() was interrupted (barge-in), return the audio the
    user spoke over JARVIS so it's prepended to the next recording. Otherwise
    return None."""
    if bargein.was_interrupted():
        return bargein.pop_interrupt_audio()
    return None


# Routine replay guard: names currently being replayed, so a routine that
# calls itself (directly or via another routine) stops instead of recursing.
_active_routine_stack = []


def _run_routine(name):
    """Replay a saved routine through the normal command handler, in order.
    Returns a line to speak, or None if nothing more needs saying.

    Each stored command runs through handle_command exactly like a live one.
    That is what guarantees a destructive action inside the routine (shutdown/
    restart/delete) still asks for its normal yes/no confirmation: the routine
    pauses, the user answers through the same flow as always, and JARVIS never
    auto-confirms just because it's a saved routine."""
    commands = routines.get_routine(name)
    if not commands:
        return persona.REPLY_ROUTINE_NOT_FOUND.format(name=name)
    if name in _active_routine_stack:
        return persona.REPLY_ROUTINE_LOOP
    _active_routine_stack.append(name)
    try:
        for cmd in commands:
            keep_going = handle_command(cmd)
            if not keep_going:
                return persona.REPLY_ROUTINE_STOPPED
            if dispatcher.PENDING_CONFIRM["action"]:
                push_history(f"(routine '{name}' paused - awaiting confirmation for a stored action)")
                return persona.REPLY_ROUTINE_AWAITING_CONFIRM
    finally:
        _active_routine_stack.remove(name)
    return persona.REPLY_ROUTINE_DONE.format(name=name, count=len(commands))


def handle_command(command):
    """Process one command. Returns False if JARVIS should shut down entirely."""
    c = command.lower().strip()

    # ---- Routine recording mode: capture this instead of running it ----
    # Comes before the confirmation check: while recording, nothing is
    # executed - a "shut down" said mid-recording is just a stored command.
    if routines.is_recording():
        tts.speak(routines.capture_for_recording(command))
        return True

    # ---- One-time "which city for the weather?" prompt ----
    # The next utterance after that prompt is the answer, not a new command.
    city_reply = weather.consume_city_answer(command)
    if city_reply is not None:
        tts.speak(city_reply)
        return True

    # If a destructive action is awaiting confirmation, this utterance must
    # answer that first, before anything else is processed.
    if dispatcher.PENDING_CONFIRM["action"]:
        action = dispatcher.PENDING_CONFIRM["action"]
        arg = dispatcher.PENDING_CONFIRM["arg"]
        dispatcher.PENDING_CONFIRM["action"] = None
        dispatcher.PENDING_CONFIRM["arg"] = None
        if any(word in c for word in dispatcher.CONFIRM_WORDS):
            tts.speak(dispatcher.execute_confirmed_action(action, arg))
        else:
            tts.speak(persona.REPLY_CANCEL)
        return True

    if c in EXIT_PHRASES:
        tts.speak(persona.REPLY_GOODBYE)
        return False

    # ---- Starting a new routine recording ----
    start_name = routines.match_start_recording(command)
    if start_name:
        routines.start_recording(start_name)
        tts.speak(persona.REPLY_ROUTINE_START.format(name=start_name))
        return True

    if "learn my voice" in c or "enroll my voice" in c or "train my voice" in c:
        enroll_voice()
        return True

    if "forget my voice" in c or "reset voice recognition" in c or "reset my voice" in c:
        reset_voice_profile()
        return True

    # ---- Routine management (list / delete) ----
    manage_reply = routines.match_manage_routines(command)
    if manage_reply:
        tts.speak(manage_reply)
        return True

    # ---- Replaying a saved routine ----
    run_name = routines.match_run_routine(command)
    if run_name:
        run_reply = _run_routine(run_name)
        if run_reply:
            tts.speak(run_reply)
        return True

    fixed_reply = dispatcher.try_fixed_command(command)
    if fixed_reply:
        tts.speak(fixed_reply)
    elif dispatcher.sounds_like_unmatched_action(command):
        tts.speak(persona.REPLY_NOT_CAPABLE)
    else:
        push_status("Thinking...")
        reply = ai.think(command)
        tts.speak(reply)
    return True


def voice_loop():
    global voice_encoder
    import comtypes

    comtypes.CoInitialize()  # required for pycaw calls from this background thread
    try:
        _voice_loop_body()
    finally:
        # Pair the CoInitialize above so COM objects are released inside this
        # thread instead of during interpreter teardown (which can segfault).
        comtypes.CoUninitialize()
        push_status("Stopped")


def _voice_loop_body():
    global voice_encoder

    if VoiceEncoder is not None and voice_encoder is None:
        push_history("(loading voice recognition model...)")
        try:
            voice_encoder = VoiceEncoder()
        except Exception as e:
            push_history(f"(couldn't load voice recognition model: {e})")

    push_history("JARVIS is running. Say 'Jarvis' to wake it up.")
    wake_model = wakeword.get_wake_model()

    def _volume_update():
        push_volume(get_volume_percent())

    while not stop_flag.is_set():
        push_status("Sleeping (say 'Jarvis')")
        if wake_model is not None:
            # On-device wake word: continuous stream, no network, instant.
            try:
                wake_waveform = wakeword.listen_for_wake_word(wake_model, on_volume=_volume_update)
            except Exception as e:
                push_history(f"(wake word listener error, falling back to legacy detection: {e})")
                wake_model = None
                continue
            if wake_waveform is None:
                continue  # stop flag fired; loop re-checks at the top
        else:
            # Legacy fallback: fixed 3 s listen + Google check for the word "Jarvis"
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

        tts.speak(random.choice(persona.WAKE_ACKS))
        push_status("Listening for your command...")
        command, command_waveform = transcribe_dynamic(max_duration=8, preroll=_pending_preroll())
        if not command:
            push_history("(didn't catch anything, going back to sleep)")
            continue
        if not dispatcher.PENDING_CONFIRM["action"] and not verify_speaker(command_waveform):
            push_history(f"(command heard, but voice didn't match: '{command}' - ignoring)")
            continue
        push_history(f"You: {command}")

        if not handle_command(command):
            break

        # --- Conversation mode ---
        silent_turns = 0
        while silent_turns < MAX_SILENT_TURNS and not stop_flag.is_set():
            push_status("Listening (conversation mode)...")
            follow_up, follow_up_waveform = transcribe_dynamic(max_duration=8, preroll=_pending_preroll())
            if not follow_up:
                silent_turns += 1
                continue
            if not dispatcher.PENDING_CONFIRM["action"] and not verify_speaker(follow_up_waveform):
                push_history(f"(other voice heard, ignoring: '{follow_up}')")
                silent_turns += 1
                continue
            push_history(f"You: {follow_up}")

            if follow_up.lower().strip() in SLEEP_PHRASES:
                tts.speak(persona.REPLY_SLEEP)
                break

            silent_turns = 0
            if not handle_command(follow_up):
                stop_flag.set()
                return


def stop_voice_loop(thread):
    """Signal the voice loop to stop and wait for it to finish its current
    audio cycle, so the audio and COM resources release cleanly inside the
    voice thread instead of during interpreter teardown (which can segfault)."""
    stop_flag.set()
    if thread is not None:
        thread.join(timeout=6)
