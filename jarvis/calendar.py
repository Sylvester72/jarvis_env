"""Calendar awareness: read today's schedule and add events by voice.

'what's on my calendar' / 'what's on my schedule today' first tries the local
Outlook calendar through win32com (pywin32) - if Outlook is installed and
configured, that's the source. If Outlook isn't available on this PC, that's
said plainly rather than failing silently, and the local JSON calendar
(data/calendar.json) is used instead.

Voice-added events ('add an event: dentist tomorrow at 3pm') always go into
the local file - writing into a live Outlook folder programmatically could
create entries the user never intended, so the local store stays the safe,
visible record. Reading merges any local events alongside Outlook so nothing
you added by voice ever disappears from view.

Date parsing deliberately reuses reminders.parse_when_phrase - the same single
date-parsing approach reminders uses - rather than duplicating it.
"""

import datetime
import json
import os
import re
import threading

from jarvis import config
from jarvis import persona
from jarvis import reminders
from jarvis.state import push_history

CALENDAR_PATH = os.path.join(config.DATA_DIR, "calendar.json")

EVENTS = []  # list of {"text", "when_iso", "all_day", "created_at"}


# ---------- persistence (same pattern as reminders.json) ----------

def load_calendar():
    global EVENTS
    EVENTS = []
    if not os.path.exists(CALENDAR_PATH):
        return
    try:
        with open(CALENDAR_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        raw = data.get("events", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
        EVENTS = [e for e in raw if isinstance(e, dict) and _parse_when(e) is not None]
    except Exception as e:
        push_history(f"(calendar couldn't be loaded: {e})")
        EVENTS = []


def save_calendar():
    try:
        with open(CALENDAR_PATH, "w", encoding="utf-8") as f:
            json.dump({"events": EVENTS}, f, indent=2)
    except Exception as e:
        push_history(f"(calendar save error: {e})")


def _parse_when(entry):
    """Recover a datetime (timed) or date (all-day) from a stored entry."""
    iso = entry.get("when_iso") if isinstance(entry, dict) else None
    if not iso:
        return None
    try:
        return datetime.datetime.fromisoformat(iso)
    except ValueError:
        pass
    try:
        return datetime.date.fromisoformat(iso)
    except (ValueError, TypeError):
        return None


def add_event(text, when):
    EVENTS.append({
        "text": text,
        "when_iso": when.isoformat(),
        "all_day": not isinstance(when, datetime.datetime),
        "created_at": datetime.datetime.now().isoformat(timespec="seconds"),
    })
    save_calendar()


# ---------- command routing ----------

def handle_calendar_command(command):
    """Route a calendar request. Returns a line to speak, or None so the
    dispatcher falls through to the AI / other handlers."""
    c = command.lower().strip()
    if _is_add_command(c):
        return _handle_add_event(command)
    if _is_read_command(c):
        return _summarize(_read_day(command))
    return None


def _is_add_command(c):
    if not re.match(r"^(add|schedule|put|create)\b", c):
        return False
    if re.match(r"^schedule\b", c):
        return True  # "schedule dentist tomorrow" has no event/calendar word
    return any(w in c for w in ("event", "appointment", "meeting", "calendar"))


def _is_read_command(c):
    return bool(re.search(r"what'?s\s+on\s+my\s+(?:calendar|schedule)", c)) \
        or bool(re.search(r"what'?s\s+my\s+schedule", c)) \
        or "check my calendar" in c or "check my schedule" in c \
        or "what do i have" in c or "what's coming up" in c


def _read_day(command):
    """Which date a 'what's on...' command means - today unless told tomorrow."""
    if "tomorrow" in command.lower():
        return datetime.date.today() + datetime.timedelta(days=1)
    return datetime.date.today()


# ---------- reading (Outlook first, local fallback) ----------

def _summarize(day):
    outlook_events, outlook_state = _read_outlook_day(day)
    local_events = _events_on_day(day)
    day_word = "tomorrow" if day == datetime.date.today() + datetime.timedelta(days=1) else "today"

    if outlook_state == "unavailable":
        base = persona.CALENDAR_OUTLOOK_UNAVAILABLE
        if not local_events:
            return base + " " + persona.REPLY_CALENDAR_EMPTY.format(day=day_word)
        return base + " " + _format_list("On your local calendar: ", local_events)

    parts = []
    if outlook_events:
        parts.append("Outlook: " + "; ".join(_format_outlook_event(e) for e in outlook_events))
    if local_events:
        parts.append("local: " + "; ".join(_format_event(e) for e in local_events))
    if not parts:
        return persona.REPLY_CALENDAR_EMPTY.format(day=day_word)
    return persona.REPLY_CALENDAR_SUMMARY.format(day=day_word, items="; ".join(parts))


# A hard time limit on the COM read. win32com.Dispatch can block indefinitely -
# Outlook isn't installed, a first-run/config dialog pops, a profile hangs - and
# this runs inside the voice thread, so it must never hang JARVIS. On timeout the
# read is abandoned (the worker is a daemon) and treated as 'unavailable'.
_OUTLOOK_TIMEOUT_SECONDS = 6


def _read_outlook_day(day):
    """One day's appointments from Outlook, bounded by a watchdog so a stuck
    Outlook can't block the voice thread. Returns (events, state) where state is
    'ok' or 'unavailable'. On timeout the worker is abandoned (it's a daemon)
    and the read is treated as 'unavailable'."""
    result = []

    def worker():
        try:
            import pythoncom
            pythoncom.CoInitialize()
            try:
                result.append(_read_outlook_now(day))
            finally:
                pythoncom.CoUninitialize()
        except Exception:
            pass

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    thread.join(timeout=_OUTLOOK_TIMEOUT_SECONDS)
    if not result:
        return [], "unavailable"  # timed out or failed - graceful fallback
    return result[0]


def _read_outlook_now(day):
    """The actual COM work - runs in a worker thread. Returns (events, 'ok') or
    ([], 'unavailable'). Any problem - Outlook not installed, no profile, COM
    failure - is 'unavailable' so the caller says it plainly instead of silently
    returning nothing."""
    try:
        import win32com.client
    except ImportError:
        return [], "unavailable"
    try:
        app = win32com.client.Dispatch("Outlook.Application")
        namespace = app.GetNamespace("MAPI")
        calendar_folder = namespace.GetDefaultFolder(9)  # olFolderCalendar
    except Exception as e:
        push_history(f"(outlook calendar unavailable: {e})")
        return [], "unavailable"

    events = []
    try:
        items = calendar_folder.Items
        items.IncludeRecurrences = True
        items.Sort("[Start]")
        for item in items:
            try:
                start = item.Start
                all_day = bool(item.AllDayEvent)
            except Exception:
                continue
            start = _to_naive_datetime(start)
            if start is None:
                continue
            if start.date() > day:
                break  # items are sorted by start time - past today's window
            if start.date() == day:
                events.append({
                    "subject": str(item.Subject or "").strip() or "Untitled appointment",
                    "start": start,
                    "all_day": all_day,
                })
    except Exception as e:
        push_history(f"(outlook calendar read error: {e})")
        return [], "unavailable"
    return events, "ok"


def _to_naive_datetime(value):
    """COM dates arrive as pywintypes.datetime (a datetime subclass) or
    occasionally as a string; normalize to a naive local datetime."""
    if isinstance(value, str):
        try:
            return datetime.datetime.fromisoformat(value.replace("Z", ""))
        except ValueError:
            return None
    if isinstance(value, datetime.datetime):
        return value.replace(tzinfo=None)
    return None


def _events_on_day(day):
    on_day = []
    for e in EVENTS:
        when = _parse_when(e)
        if when is None:
            continue
        if isinstance(when, datetime.datetime):
            if when.date() == day:
                on_day.append(e)
        elif when == day:
            on_day.append(e)
    on_day.sort(key=_event_sort_key)
    return on_day


def _event_sort_key(e):
    when = _parse_when(e)
    if isinstance(when, datetime.datetime):
        return when
    return datetime.datetime.combine(when, datetime.time.min)  # all-day sorts first


# ---------- formatting for spoken replies ----------

def _clock(dt):
    return dt.strftime("%I:%M %p").lstrip("0")


def _format_event(e):
    """A local calendar entry as a short spoken phrase."""
    when = _parse_when(e)
    text = (e.get("text") or "").strip() or "Untitled event"
    if isinstance(when, datetime.datetime):
        return f"{text} at {_clock(when)}"
    return f"{text}, all day"


def _format_outlook_event(e):
    """An Outlook appointment as a short spoken phrase."""
    if e["all_day"]:
        return f"{e['subject']}, all day"
    return f"{e['subject']} at {_clock(e['start'])}"


def _format_list(prefix, events):
    items = "; ".join(_format_event(e) for e in events)
    return (prefix + items) if items else ""


def _format_when(when):
    if isinstance(when, datetime.datetime):
        return reminders._format_when(when)
    today = datetime.date.today()
    if when == today:
        return "today"
    if when == today + datetime.timedelta(days=1):
        return "tomorrow"
    return f"on {when.strftime('%B %d')}"


# ---------- adding events ----------

def _handle_add_event(command):
    parsed = parse_add_event_command(command)
    if parsed is None:
        parsed = _llm_extract_event(command)
    if parsed is None:
        return persona.REPLY_EVENT_UNPARSEABLE
    text, when = parsed
    add_event(text, when)
    return persona.REPLY_EVENT_ADDED.format(text=text, when=_format_when(when))


_ACTION_PREFIX_RE = re.compile(
    r"^\s*(?:add|schedule|put|create)\s+(?:an?\s+)?"
    r"(?:event|appointment|meeting|to my calendar|on my calendar)?\s*[:,\-]?\s*",
    re.IGNORECASE,
)

_WHEN_START = (
    r"at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)"
    r"|at\s+\d{1,2}:\d{2}"
    r"|in\s+(?:\d+|a|an)\s+(?:seconds?|mins?|minutes?|hrs?|hours?|days?|weeks?)"
    r"|today|tomorrow"
    r"|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)"
    r"|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)"
    r"|on\s+(?:january|february|march|april|may|june|july|august|september|"
    r"october|november|december)\s+\d{1,2}"
)
# The trailing '(?:\b.*)?' must live INSIDE the capture group so a when like
# 'tomorrow at 3pm' is captured whole, not just its first word.
_WHEN_END_RE = re.compile(r"(?i)\b(?P<when>(" + _WHEN_START + r")(?:\b.*)?)$")


def _clean_event_text(raw):
    text = _ACTION_PREFIX_RE.sub("", raw)
    text = re.sub(r"(?i)^\s*on\s+my\s+calendar\s+", "", text)
    text = re.sub(r"(?i)\s+on\s+my\s+calendar\s*$", "", text)
    text = re.sub(r"(?i)\s+(?:for|on|to)\s*$", "", text)
    return text.strip()


def parse_add_event_command(command):
    """Split 'add an event: dentist tomorrow at 3pm' into (text, when), where
    when is a datetime (timed) or a date (all-day). Returns None when no when
    phrase is found - the caller falls back to the LLM."""
    m = _WHEN_END_RE.search(command)
    if not m:
        return None
    when = reminders.parse_when_phrase(m.group("when"))
    if when is None:
        return None
    text = _clean_event_text(command[:m.start()])
    if not text:
        return None
    return text, when


def _llm_extract_event(command):
    """Fallback for phrasing the regex path can't pin down. Reuses the reminder
    LLM extractor (the same prompt + JSON contract) by rephrasing the command as
    a reminder, then cleans the event text back out."""
    wrapped = _clean_event_text(command)
    if not wrapped:
        return None
    parsed = reminders._llm_extract_reminder("remind me to " + wrapped)
    if parsed is None:
        return None
    text, trigger = parsed
    return text, trigger