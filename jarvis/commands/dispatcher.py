"""FAST FIXED COMMANDS and the destructive-action confirmation flow.

The order of the checks in try_fixed_command is deliberate and load-bearing
- earlier checks pre-empt later ones (e.g. shutdown-cancel before the
shutdown prompt, delete-confirm before generic file actions). Keep the order.
"""

import datetime
import os
import re
import subprocess
import webbrowser

from jarvis import ai
from jarvis import calendar
from jarvis import filesearch
from jarvis import mathcalc
from jarvis import memory
from jarvis import news
from jarvis import persona
from jarvis import reminders
from jarvis import weather
from jarvis.state import push_history
from jarvis.commands import camera, files, media, security, system, vision

# Tracks a pending destructive action awaiting a yes/no confirmation.
# 'arg' carries extra info the action needs, e.g. which file to delete.
PENDING_CONFIRM = {"action": None, "arg": None}

CONFIRM_WORDS = ("yes", "confirm", "do it", "go ahead", "sure", "alright", "all right", "yep", "yeah")
DENY_WORDS = ("no", "cancel", "nevermind", "never mind", "stop")


def execute_confirmed_action(action, arg=None):
    if action == "shutdown":
        os.system("shutdown /s /t 5")
        return persona.REPLY_CONFIRMED_SHUTDOWN
    if action == "restart":
        os.system("shutdown /r /t 5")
        return persona.REPLY_CONFIRMED_RESTART
    if action == "delete":
        return files.delete_item(arg)
    return "Okay."


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
    "remind me to <thing> in <duration> / at <time>",
    "list reminders / cancel reminders",
    "what's on my calendar / my schedule [today or tomorrow]",
    "add an event: <thing> <when> (e.g. 'dentist tomorrow at 3pm')",
    "learn this as <name> (record a routine)",
    "do <name> (replay a routine)",
    "list routines / delete routine <name>",
    "lock the computer",
    "open documents / downloads / desktop",
    "find my <filename> (read-only search of Desktop/Documents/Downloads)",
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
    "what's 47 times 12 / square root of 144 (direct math)",
    "what's the weather [in <city>]",
    "what's the news / give me the headlines",
]

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


# Read-only file search triggers. This must be handled EARLY (before the
# generic 'documents'/'downloads'/'photo'/'settings' handlers) so 'find my
# documents' searches for a file rather than opening the Documents folder, and
# 'find my photo' searches files rather than grabbing the webcam.
_FILE_SEARCH_RE = re.compile(
    r"(?:find\s+my\s+"
    r"|find\s+(?:a|an|the)?\s*file\s+(?:called|named)\s+"
    r"|search\s+for\s+(?:a|an|the)?\s*file\s+(?:called|named)\s+"
    r"|search\s+for\s+(?:a|an)?\s*file\s+"
    r"|look\s+for\s+(?:a|an|the)?\s*file\s+(?:called|named)\s+)"
    r"(.+)",
    re.IGNORECASE,
)


def _extract_file_search_query(command):
    m = _FILE_SEARCH_RE.search(command)
    if m:
        return m.group(1).strip() or None
    return None


def try_fixed_command(command):
    c = command.lower()

    # ---- Reminders / alarms (checked BEFORE destructive actions - "remind me
    # to shut down in 5 minutes" is a reminder, not a shutdown confirmation) ----
    if "remind" in c or "reminder" in c or "alarm" in c:
        return reminders.handle_reminder_command(command)

    # ---- Calendar (read schedule / add an event). Also before destructive
    # actions: "schedule a shutdown tomorrow" is an event, not a shutdown.
    # handle_calendar_command returns None for calendar-ish words in unrelated
    # commands, so they fall through to the checks below. ----
    if ("calendar" in c or "schedule" in c or "event" in c or "appointment" in c
            or "meeting" in c or "coming up" in c):
        reply = calendar.handle_calendar_command(command)
        if reply is not None:
            return reply

    # ---- Read-only file search (Desktop/Documents/Downloads only). Checked
    # here, before 'documents'/'downloads'/'photo'/etc., so "find my documents"
    # searches files instead of opening the folder. Returns None for unrelated
    # commands, letting them fall through. ----
    file_query = _extract_file_search_query(command)
    if file_query:
        return filesearch.search_files(file_query)

    # ---- Direct math / quick answers (safe ast evaluator - never eval/exec).
    # Returns None for non-math commands, so they fall through below. ----
    math_reply = mathcalc.handle_math_command(command)
    if math_reply is not None:
        return math_reply

    # ---- Destructive actions needing confirmation (checked first) ----
    if "cancel" in c and ("shutdown" in c or "shut down" in c or "restart" in c):
        os.system("shutdown /a")
        return persona.REPLY_ABORT_POWER

    if "shut down" in c or "shutdown" in c or "power off" in c:
        PENDING_CONFIRM["action"] = "shutdown"
        return persona.CONFIRM_SHUTDOWN

    if "restart" in c or "reboot" in c:
        PENDING_CONFIRM["action"] = "restart"
        return persona.CONFIRM_RESTART

    if c.startswith("delete "):
        name = command[len("delete "):].strip()
        if name:
            PENDING_CONFIRM["action"] = "delete"
            PENDING_CONFIRM["arg"] = name
            return persona.CONFIRM_DELETE.format(name=name)

    if "lock" in c and ("computer" in c or "pc" in c or "screen" in c):
        return system.lock_computer()

    if "scan" in c and ("virus" in c or "malware" in c or "spyware" in c):
        return security.run_virus_scan(quick=("full" not in c))

    if "windows security" in c or "windows defender" in c:
        return security.open_windows_security()

    if "photo" in c or "picture" in c:
        return camera.take_photo()

    if "camera preview" in c or "show camera" in c or "camera feed" in c:
        return camera.open_camera_preview()

    if "open camera" in c or "start camera" in c:
        return camera.open_camera_preview()

    if "what's on my screen" in c or "what is on my screen" in c or "describe my screen" in c or "look at my screen" in c:
        return vision.describe_screen_async()

    if "sleep" in c and ("computer" in c or "pc" in c or "system" in c):
        return system.sleep_computer()

    if "screenshot" in c:
        return system.take_screenshot()

    if "documents" in c:
        return system.open_folder("Documents")

    if "downloads" in c:
        return system.open_folder("Downloads")

    if "open desktop" in c or ("desktop" in c and "folder" in c):
        return system.open_folder("Desktop")

    if "show desktop" in c or "minimize" in c:
        return system.show_desktop()

    if "recycle bin" in c:
        return system.empty_recycle_bin()

    if "control panel" in c:
        return system.control_panel()

    if "settings" in c:
        return system.settings()

    if "command prompt" in c or "cmd" in c:
        return system.command_prompt()

    if "open notepad" in c:
        return system.notepad()

    if "open calculator" in c:
        return system.calculator()

    if "manager" in c and ("task" in c or "tax" in c or "tusk" in c):
        return system.task_manager()

    if "explorer" in c or "open files" in c or "file explorer" in c:
        return system.explorer()

    if "open chrome" in c or "open browser" in c:
        return system.browser()

    if "search for" in c:
        query = c.split("search for", 1)[1].strip()
        return system.search(query)

    if "mute" in c and "unmute" not in c:
        return system.mute()

    if "unmute" in c:
        return system.unmute()

    if "volume" in c:
        match = re.search(r"(\d{1,3})", c)
        if match:
            return system.set_volume(match.group(1))
        if "up" in c:
            return system.set_volume(80)
        if "down" in c:
            return system.set_volume(20)
        if "max" in c:
            return system.set_volume(100)

    # ---- Weather (Open-Meteo) ----
    if "weather" in c:
        return weather.handle_weather_command(command)

    # ---- News headlines (RSS) ----
    if "news" in c or "headline" in c or "more about" in c or "tell me more" in c or "expand" in c:
        return news.handle_news_command(command)

    if "time" in c:
        return system.current_time()

    if "date" in c or "what day" in c:
        return system.current_date()

    # ---- Memory commands ----
    if c.startswith("remember that "):
        fact = command[len("remember that "):].strip()
    elif c.startswith("remember "):
        fact = command[len("remember "):].strip()
    else:
        fact = None
    if fact:
        memory.FACTS.append(fact)
        memory.save_memory()
        ai.update_system_prompt()
        return persona.REPLY_REMEMBER.format(fact=fact)

    if "what do you remember" in c or "what do you know about me" in c:
        if memory.FACTS:
            return "Here's what I remember: " + "; ".join(memory.FACTS)
        return persona.REPLY_NO_FACTS

    if "forget everything" in c or "clear your memory" in c or "forget what you know" in c:
        memory.FACTS.clear()
        memory.save_memory()
        ai.update_system_prompt()
        return persona.REPLY_FORGET_ALL

    # ---- Named apps ----
    if "open" in c or "launch" in c or "start" in c:
        for app_name in system.APP_PATHS:
            if app_name in c:
                result = system.open_named_app(app_name)
                if result:
                    return result

    # ---- Web shortcuts ----
    for site_name, url in system.SITE_SHORTCUTS.items():
        if site_name in c:
            webbrowser.open(url)
            return f"Opening {site_name.title()}."

    # ---- Media controls ----
    if "pause" in c or "resume" in c or "play music" in c or "play song" in c or c.strip() == "play":
        return media.media_play_pause()

    if "next song" in c or "next track" in c or "skip song" in c or "skip track" in c:
        return media.media_next()

    if "previous song" in c or "previous track" in c or "last song" in c or "go back a song" in c:
        return media.media_prev()

    # ---- Brightness ----
    if "brightness" in c:
        match = re.search(r"(\d{1,3})", c)
        if match:
            return system.set_brightness(match.group(1))
        if "up" in c:
            return system.set_brightness(90)
        if "down" in c:
            return system.set_brightness(30)

    # ---- File actions (Desktop only) ----
    if c.startswith("create a file called ") or c.startswith("create file called "):
        name = command.split("called ", 1)[1].strip()
        return files.create_file(name)

    if c.startswith("create a folder called ") or c.startswith("create folder called "):
        name = command.split("called ", 1)[1].strip()
        return files.create_folder(name)

    rename_match = re.search(r"rename (.+) to (.+)", command, re.IGNORECASE)
    if rename_match:
        return files.rename_item(rename_match.group(1).strip(), rename_match.group(2).strip())

    return None  # no fixed command matched, fall through to the AI
