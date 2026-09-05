"""CAMERA: take a photo, or open a live preview window."""

import datetime
import os
import threading

try:
    import cv2
except ImportError:
    cv2 = None  # camera commands will explain it needs 'pip install opencv-python'

from jarvis import config
from jarvis.state import push_history


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
        path = os.path.join(config.DESKTOP_PATH, filename)
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
