"""Shared cross-thread state: the message queue from the voice thread to the
GUI thread, the stop flag, and the push_* helpers that enqueue updates."""

import datetime
import queue
import threading

from jarvis import memory

gui_queue = queue.Queue()
stop_flag = threading.Event()


def push_status(text):
    gui_queue.put(("status", text))


def push_history(text, save=True):
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    memory.LOG.append([timestamp, text])
    gui_queue.put(("history", (timestamp, text)))
    if save:
        memory.save_memory()


def push_volume(value):
    gui_queue.put(("volume", value))
