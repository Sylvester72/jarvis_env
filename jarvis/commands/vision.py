"""SCREEN VISION
Takes a screenshot and asks a local vision model (llava, via Ollama) to
describe it. Runs as its own call since it needs a different model than
regular conversation - kept separate from the main think()/conversation
history so a big image doesn't bloat every future exchange."""

import base64
import io
import threading

try:
    from PIL import ImageGrab
except ImportError:
    ImageGrab = None  # screen vision will explain it needs 'pip install pillow'

from jarvis import ai
from jarvis import tts
from jarvis.state import push_history, push_status


def describe_screen():
    if ImageGrab is None:
        return "Screen vision needs the 'pillow' package - run: pip install pillow"
    try:
        screenshot = ImageGrab.grab()
        buf = io.BytesIO()
        screenshot.save(buf, format="PNG")
        image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return ai._ollama_vision_describe(image_b64)
    except Exception as e:
        push_history(f"(screen vision error: {e})")
        return ("I couldn't analyze the screen. Make sure you've run "
                "'ollama pull llava' at least once.")


def describe_screen_async():
    def _vision_worker():
        push_status("Analyzing your screen...")
        result = describe_screen()
        tts.speak(result)

    threading.Thread(target=_vision_worker, daemon=True).start()
    return "Let me take a look..."
