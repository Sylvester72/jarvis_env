"""Custom routines / macros.

"Jarvis, learn this as <name>" enters a recording mode: every command spoken
afterward is appended to the routine instead of executed, until "that's the
routine" or "done recording" ends it. The routine is saved to data/routines.json
as a named, ordered list of command strings. "Jarvis, do <name>" replays it,
running each stored command through the normal command handler in order.

Replay intentionally goes through the exact same handle_command path as a live
command. That is what guarantees a destructive action (shutdown/restart/delete)
inside a routine still asks for the normal yes/no confirmation - the routine
pauses and waits for the answer, and never auto-confirms on its own.

This module only owns the data and the matching. The actual replay loop lives
in voice.py (it needs to re-enter handle_command, which would create an import
cycle from here).
"""

import json
import os
import re
import threading

from jarvis import config
from jarvis import persona
from jarvis.state import push_history

ROUTINES_PATH = os.path.join(config.DATA_DIR, "routines.json")

ROUTINES = {}  # name (lowercase) -> ordered list of command strings

_recording_name = None
_recording_commands = []
_recording_lock = threading.Lock()  # voice loop is single-threaded, but keep it honest


# ---------- recording mode ----------

def is_recording():
    return _recording_name is not None


def start_recording(name):
    global _recording_name, _recording_commands
    with _recording_lock:
        _recording_name = name.strip().lower()
        _recording_commands = []


def recording_name():
    return _recording_name


_END_PHRASES = (
    "that's the routine",
    "thats the routine",
    "done recording",
    "end recording",
    "finish the routine",
    "save the routine",
    "stop recording",
    "that's it",
)

_CANCEL_PHRASES = (
    "cancel the routine",
    "discard the routine",
    "abort the routine",
    "never mind the routine",
    "forget the routine",
    "don't save the routine",
)


def capture_for_recording(command):
    """Append a spoken command to the current routine, or finish/cancel it if
    the phrase says so. Returns the line to speak. Only called while recording."""
    c = command.lower().strip()
    if any(p in c for p in _END_PHRASES):
        return _finish_recording()
    if any(p in c for p in _CANCEL_PHRASES):
        return _cancel_recording()
    with _recording_lock:
        _recording_commands.append(command.strip())
        count = len(_recording_commands)
    return persona.REPLY_ROUTINE_RECORDED.format(
        count=count, s="" if count == 1 else "s")


def _finish_recording():
    global _recording_name, _recording_commands
    with _recording_lock:
        name, commands = _recording_name, _recording_commands
        _recording_name, _recording_commands = None, []
    if not commands:
        return persona.REPLY_ROUTINE_EMPTY
    ROUTINES[name] = commands
    save_routines()
    count = len(commands)
    return persona.REPLY_ROUTINE_SAVED.format(name=name, count=count, s="" if count == 1 else "s")


def _cancel_recording():
    global _recording_name, _recording_commands
    with _recording_lock:
        _recording_name, _recording_commands = None, []
    return persona.REPLY_ROUTINE_DISCARDED


# ---------- matching spoken phrasings ----------

_START_PATTERNS = (
    re.compile(r"learn\s+this\s+as\s+(.+)$", re.IGNORECASE),
    re.compile(r"record\s+this\s+as\s+(.+)$", re.IGNORECASE),
    re.compile(r"save\s+this\s+as\s+(.+)$", re.IGNORECASE),
    re.compile(r"create\s+(?:a|an)\s+routine\s+(?:called|named)\s+(.+)$", re.IGNORECASE),
    re.compile(r"make\s+(?:a|an)\s+routine\s+(?:called|named)\s+(.+)$", re.IGNORECASE),
    re.compile(r"start\s+recording\s+(.+)$", re.IGNORECASE),
    re.compile(r"record\s+(?:a|an)\s+routine\s+(?:called|named)\s+(.+)$", re.IGNORECASE),
)


def match_start_recording(command):
    """Returns the routine name if the command starts a recording, else None."""
    c = command.strip()
    for pattern in _START_PATTERNS:
        m = pattern.search(c)
        if m:
            name = m.group(1).strip()
            return name.lower() if name else None
    return None


_RUN_PREFIXES = ("do ", "run ", "execute ", "replay ", "perform ")


def _routine_name_candidates(rest):
    """All the ways "the morning routine" might reduce to a stored name, so
    "do morning", "do the morning" and "run the morning routine" all work."""
    cands = {rest}
    cur = rest
    if cur.startswith("the "):
        cur = cur[len("the "):].strip()
        cands.add(cur)
    if cur.endswith(" routine"):
        cands.add(cur[:-len(" routine")].strip())
    if rest.endswith(" routine"):
        base = rest[:-len(" routine")].strip()
        cands.add(base)
        if base.startswith("the "):
            cands.add(base[len("the "):].strip())
    return cands


def match_run_routine(command):
    """Returns the routine name if the command is "do/run <name>", else None.
    The name must match a saved routine - a prefix alone is never enough, so a
    stray "do you..." or "run a scan" just falls through to normal handling."""
    c = command.lower().strip()
    for lead in _RUN_PREFIXES:
        if c.startswith(lead):
            rest = c[len(lead):].strip()
            for cand in _routine_name_candidates(rest):
                if cand in ROUTINES:
                    return cand
    return None


def match_manage_routines(command):
    """Handle "list routines" / "delete routine <name>". Returns a line to
    speak, or None if it's not a routine-management command."""
    c = command.lower().strip()

    m = re.search(r"(?:delete|remove|forget)\s+(?:the\s+)?routine\s+(.+)$", c)
    if m:
        return _delete_routine(m.group(1).strip())

    if re.search(r"(?:delete|remove|forget)\s+(?:the\s+)?routine$", c):
        return persona.REPLY_ROUTINE_DELETE_WHICH

    if "clear routines" in c or "delete all routines" in c or "remove all routines" in c:
        return _clear_routines()

    if "what routines" in c or "list routines" in c or "show routines" in c or "my routines" in c:
        return _list_routines()
    return None


def get_routine(name):
    return ROUTINES.get(name.strip().lower())


def _list_routines():
    if not ROUTINES:
        return persona.REPLY_ROUTINES_NONE
    names = ", ".join(sorted(ROUTINES.keys()))
    return persona.REPLY_ROUTINES_LIST.format(names=names)


def _delete_routine(name):
    name = name.lower()
    if name not in ROUTINES:
        return persona.REPLY_ROUTINE_CANT_DELETE.format(name=name)
    del ROUTINES[name]
    save_routines()
    return persona.REPLY_ROUTINE_DELETED.format(name=name)


def _clear_routines():
    global ROUTINES
    n = len(ROUTINES)
    ROUTINES = {}
    save_routines()
    return persona.REPLY_ROUTINES_CLEARED if n else persona.REPLY_ROUTINES_NONE


# ---------- persistence (same pattern as memory.json) ----------

def load_routines():
    global ROUTINES
    ROUTINES = {}
    if not os.path.exists(ROUTINES_PATH):
        return
    try:
        with open(ROUTINES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            ROUTINES = {
                str(name).lower(): [str(cmd) for cmd in cmds if isinstance(cmd, str)]
                for name, cmds in data.items()
                if isinstance(cmds, list)
            }
    except Exception as e:
        push_history(f"(routines couldn't be loaded: {e})")
        ROUTINES = {}


def save_routines():
    try:
        with open(ROUTINES_PATH, "w", encoding="utf-8") as f:
            json.dump(ROUTINES, f, indent=2)
    except Exception as e:
        push_history(f"(routines save error: {e})")
