"""The local AI brain: Ollama chat for open-ended conversation, the system
prompt that keeps it honest about its real capabilities, and the screen
vision call (llava)."""

import requests

from jarvis import config
from jarvis import memory
from jarvis import persona
from jarvis.state import push_history

CAPABILITIES_TEXT = (
    "You can ONLY actually perform these actions on the PC (nothing else): "
    "open Notepad, open Calculator, open Task Manager, open File Explorer, "
    "open a web browser, search Google, mute/unmute/set system volume, "
    "tell the time or date, remember/recall/forget facts, set reminders and "
    "alarms (say 'remind me to <thing> in <duration>' or 'at <time>'), "
    "create and replay saved routines of commands (say 'learn this as <name>' "
    "to record one, then 'do <name>' to run it; a destructive action inside a "
    "routine still asks for confirmation before running), "
    "read your calendar and add events (say 'what's on my calendar' or 'add an "
    "event: dentist tomorrow at 3pm'; voice-added events go to a local calendar "
    "file, and Outlook is read when it's available), "
    "lock the computer, "
    "open Documents/Downloads/Desktop folders, "
    "find a file by name in your Desktop, Documents, or Downloads folders "
    "(say 'find my <name>' or 'search for a file called <name>' - this is "
    "read-only, it only tells you where matches are and never opens or changes "
    "anything), "
    "take a screenshot, open "
    "Settings or Control Panel, toggle show desktop, empty the recycle bin, "
    "open Command Prompt, shut down/restart/sleep the PC (with a "
    "confirmation step), open specific apps like Spotify/Discord/Word/Excel/"
    "Steam if their path is configured, open specific websites like YouTube/"
    "Gmail/Reddit/GitHub, control media playback (play/pause/next/previous - "
    "works on whatever app is currently playing), set screen brightness, and "
    "create/rename/delete files or folders on the Desktop only (delete asks "
    "for confirmation first), run a Windows Defender virus/malware scan, "
    "open Windows Security, take a photo or show a live preview from the "
    "webcam, describe what's currently on screen using a vision model, report "
    "the current weather (say 'what's the weather' or 'what's the weather in "
    "<city>'), read the top news headlines (say 'what's the news'), and answer "
    "arithmetic out loud (say 'what's 47 times 12' or 'what's the square root "
    "of 144' - the program computes it safely, it doesn't open a calculator). "
    "You have NO "
    "ability to control smart home devices, send messages, "
    "browse the web yourself, or fetch arbitrary live information on your "
    "own - the program handles specific fetch commands like weather and news "
    "before they reach you. You have no ability to "
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
    content = persona.PERSONA + CAPABILITIES_TEXT
    if memory.FACTS:
        content += " Known facts you've been told to remember about the user: " + "; ".join(memory.FACTS) + "."
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
            config.OLLAMA_URL,
            json={"model": config.MODEL, "messages": conversation_history, "stream": False},
            timeout=30,
        )
        response.raise_for_status()
        reply = response.json()["message"]["content"]
        conversation_history.append({"role": "assistant", "content": reply})
        return reply
    except requests.exceptions.ConnectionError:
        return persona.ERR_OLLAMA_DOWN
    except Exception as e:
        push_history(f"(Ollama error: {e})")
        return persona.ERR_THINKING


def _ollama_vision_describe(image_b64):
    """Ask the local vision model to describe a base64-encoded screenshot.
    Runs as its own call since it needs a different model than regular
    conversation - kept separate from the main think()/conversation history
    so a big image doesn't bloat every future exchange."""
    try:
        response = requests.post(
            config.OLLAMA_URL,
            json={
                "model": config.VISION_MODEL,
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
        return persona.ERR_OLLAMA_DOWN
    except Exception as e:
        push_history(f"(screen vision error: {e})")
        return ("I couldn't analyze the screen. Make sure you've run "
                "'ollama pull llava' at least once.")
