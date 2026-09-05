"""Persistent memory: facts you've explicitly asked JARVIS to remember, and
the conversation log. Survives closing and reopening JARVIS."""

import json
import os

from jarvis import config

MEMORY_PATH = config.MEMORY_PATH
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
