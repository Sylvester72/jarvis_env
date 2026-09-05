"""Reminders and alarms.

"Remind me to call mom in 10 minutes" / "remind me to drink water at 3pm" is
parsed by a fast regex path first. Anything the regex can't pin down (natural
phrasing varies a lot) falls back to asking the local LLM for a structured
{reminder_text, trigger_datetime} JSON. A background scheduler thread watches
the pending list and fires the reminder with the normal speak() when its time
comes.

Pending reminders are persisted to data/reminders.json - the same pattern as
memory.json - so they survive a restart. On load, only triggers still in the
future are kept; stale ones from a missed session are dropped.
"""

import datetime
import json
import os
import re
import threading

import requests

from jarvis import config
from jarvis import persona
from jarvis import tts
from jarvis.state import push_history, stop_flag

REMINDERS_PATH = os.path.join(config.DATA_DIR, "reminders.json")
SCHEDULER_TICK_SECONDS = 5  # how often the scheduler checks for due reminders

REMINDERS = []  # list of {"text": str, "trigger_iso": str, "created_at": str}

_scheduler_started = False


# ---------- parsing: fast regex path for common phrasings ----------
# (the LLM is the fallback for everything the regexes don't cover)

_UNIT_SECONDS = {
    "second": 1, "seconds": 1,
    "minute": 60, "minutes": 60, "min": 60, "mins": 60,
    "hour": 3600, "hours": 3600, "hr": 3600, "hrs": 3600,
    "day": 86400, "days": 86400,
    "week": 604800, "weeks": 604800,
}

_DURATION_RE = re.compile(
    r"(?:remind me|set (?:a|an) (?:reminder|alarm))(?:\s+to)?\s+"
    r"(?P<text>.+?)\s+in\s+(?P<n>(?:\d+|a|an))\s+"
    r"(?P<unit>seconds?|mins?|minutes?|hrs?|hours?|days?|weeks?)",
    re.IGNORECASE,
)

_DURATION_REVERSE_RE = re.compile(
    r"remind me\s+in\s+(?P<n>(?:\d+|a|an))\s+"
    r"(?P<unit>seconds?|mins?|minutes?|hrs?|hours?|days?|weeks?)\s+to\s+"
    r"(?P<text>.+?)\s*$",
    re.IGNORECASE,
)

_AT_RE = re.compile(
    r"(?:remind me|set (?:a|an) (?:reminder|alarm))(?:\s+to)?\s+"
    r"(?P<text>.+?)\s+at\s+"
    r"(?P<time>\d{1,2}(?::\d{2})?(?:\s*(?:am|pm|a\.m\.|p\.m\.))?)",
    re.IGNORECASE,
)

_ALARM_AT_RE = re.compile(
    r"(?:set (?:an? )?alarm|alarm)\s+(?:for\s+)?at\s+"
    r"(?P<time>\d{1,2}(?::\d{2})?(?:\s*(?:am|pm|a\.m\.|p\.m\.))?)",
    re.IGNORECASE,
)

# ---- shared 'when' phrase parsing (reminders AND calendar events) ----
# parse_when_phrase below is the single date parser both features use, so a
# "when" phrased to one works identically for the other. It reuses the same
# duration/clock helpers as the regexes above.

_WHEN_DURATION_RE = re.compile(
    r"\bin\s+(?P<n>(?:\d+|a|an))\s+"
    r"(?P<unit>seconds?|mins?|minutes?|hrs?|hours?|days?|weeks?)\b",
    re.IGNORECASE,
)

_CLOCK_RE = re.compile(
    r"(?:\d{1,2}:\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)?|"
    r"\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.))",
    re.IGNORECASE,
)

_WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5,
    "june": 6, "july": 7, "august": 8, "september": 9, "october": 10,
    "november": 11, "december": 12,
}


def _quantity_to_number(n):
    n = n.strip().lower()
    return 1 if n in ("a", "an") else int(n)


def _parse_clock_time(raw):
    """Parse '3pm', '3:30 pm', '15:30', '8' into a datetime.time, or None.
    'am'/'pm' honored when present; otherwise the bare 24-hour reading is used."""
    raw = raw.strip().lower()
    hour = minute = None
    am_pm = None
    m = re.search(r"(am|pm|a\.m\.|p\.m\.)", raw)
    if m:
        am_pm = m.group(1)[0]  # 'a' or 'p'
        raw = raw[:m.start()].strip()
    parts = raw.split(":")
    try:
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
    except (ValueError, IndexError):
        return None
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    if am_pm == "a" and hour == 12:
        hour = 0
    elif am_pm == "p" and hour != 12:
        hour += 12
    return datetime.datetime.now().replace(hour=hour, minute=minute, second=0, microsecond=0)


def parse_reminder_command(command):
    """Regex path. Returns (text, trigger_datetime) or None if nothing matches."""
    m = _DURATION_RE.search(command)
    if m:
        seconds = _quantity_to_number(m.group("n")) * _UNIT_SECONDS[m.group("unit").lower()]
        return m.group("text").strip(), datetime.datetime.now() + datetime.timedelta(seconds=seconds)

    m = _DURATION_REVERSE_RE.search(command)
    if m:
        seconds = _quantity_to_number(m.group("n")) * _UNIT_SECONDS[m.group("unit").lower()]
        return m.group("text").strip(), datetime.datetime.now() + datetime.timedelta(seconds=seconds)

    m = _ALARM_AT_RE.search(command)
    if m:
        trigger = _parse_clock_time(m.group("time"))
        if trigger is not None:
            # "set an alarm at 7am" - the thing being reminded is the alarm itself
            return "your alarm", _roll_past_trigger(trigger)

    m = _AT_RE.search(command)
    if m:
        trigger = _parse_clock_time(m.group("time"))
        if trigger is not None:
            return m.group("text").strip(), _roll_past_trigger(trigger)

    return None


def _roll_past_trigger(trigger):
    """A clock time is assumed to be today; if it's already passed (you said
    'at 3pm' at 4pm), the sensible reading is tomorrow."""
    if trigger <= datetime.datetime.now():
        return trigger + datetime.timedelta(days=1)
    return trigger


def _next_weekday(weekday_idx):
    """The next occurrence of a weekday (0=Monday..6=Sunday), starting from
    today. Returns a date."""
    today = datetime.date.today()
    return today + datetime.timedelta(days=(weekday_idx - today.weekday()) % 7)


def _month_day_date(month_name, day):
    """Build a date for '<month_name> <day>' this year, or None if invalid."""
    try:
        return datetime.date(datetime.date.today().year, _MONTHS[month_name], day)
    except (ValueError, KeyError):
        return None


def parse_when_phrase(phrase):
    """Parse a spoken 'when' phrase, reusing the same clock/duration helpers as
    the reminder regexes - this is the ONE date parser shared by reminders and
    calendar events, so 'tomorrow at 3pm' reads the same to both.

    Returns a ``datetime.datetime`` for a timed point, a ``datetime.date`` for
    an all-day event (no clock time given), or None when the phrase can't be
    pinned down. Understands 'in 20 minutes', 'at 3pm', 'today at 5pm',
    'tomorrow at 3pm', 'next tuesday at 9am', 'monday at 2pm', and
    'on august 5 at 6pm'."""
    if not phrase or not isinstance(phrase, str):
        return None
    p = phrase.strip().lower()
    if not p:
        return None

    # Relative first: "in 20 minutes", "in an hour"
    m = _WHEN_DURATION_RE.search(p)
    if m:
        seconds = _quantity_to_number(m.group("n")) * _UNIT_SECONDS[m.group("unit").lower()]
        return datetime.datetime.now() + datetime.timedelta(seconds=seconds)

    clock = None
    m = _CLOCK_RE.search(p)
    if m:
        clock_dt = _parse_clock_time(m.group(0))
        clock = clock_dt.time() if clock_dt is not None else None

    now = datetime.datetime.now()

    if "tomorrow" in p:
        base, kind = now.date() + datetime.timedelta(days=1), "tomorrow"
    elif "today" in p:
        base, kind = now.date(), "today"
    else:
        m = re.search(r"\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", p)
        if m:
            base, kind = _next_weekday(_WEEKDAYS[m.group(1)]), "weekday"
            if base == now.date():  # "next monday" said on a monday = a week out
                base = base + datetime.timedelta(days=7)
        else:
            m = re.search(r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", p)
            if m:
                base, kind = _next_weekday(_WEEKDAYS[m.group(1)]), "weekday"
            else:
                m = re.search(
                    r"\bon\s+(january|february|march|april|may|june|july|august|"
                    r"september|october|november|december)\s+(\d{1,2})\b", p)
                if m:
                    base = _month_day_date(m.group(1), int(m.group(2)))
                    if base is None:
                        return None
                    kind = "date"
                else:
                    base, kind = now.date(), "bare"

    if clock is None:
        if kind == "bare":
            return None  # no day word and no clock - nothing to pin down
        # No clock time -> an all-day event on that date. A date already passed
        # this year is read as next year.
        if kind == "date" and base < now.date():
            base = base.replace(year=base.year + 1)
        return base

    dt = datetime.datetime.combine(base, clock)
    if kind in ("today", "tomorrow"):
        return dt
    if kind == "bare":
        return _roll_past_trigger(dt)          # "at 3pm" said at 4pm means tomorrow
    if kind == "weekday" and dt < now:
        return dt + datetime.timedelta(days=7)  # that day's time already passed this week
    if kind == "date" and dt < now:
        return dt.replace(year=dt.year + 1)     # "on august 5" already passed this year
    return dt


# ---------- LLM fallback ----------

def _llm_extract_reminder(command):
    """Ask the local LLM to pull a {text, trigger_datetime} JSON out of phrasing
    the regex path couldn't handle. Best-effort: returns (text, datetime) or
    None if Ollama is down or the answer isn't usable."""
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    system = (
        "You convert a spoken reminder request into JSON. Reply with ONLY a "
        "valid JSON object and nothing else - no prose, no markdown fences - of "
        'the form {"text": "the thing to be reminded about", "trigger_datetime": '
        '"YYYY-MM-DD HH:MM"}. The trigger_datetime must be an absolute local '
        "date and time, strictly in the future, worked out from the current "
        "local date and time you are given. Never return relative phrases like "
        "'tomorrow' or 'in 20 minutes'."
    )
    user = f"Current local date/time: {now}\nCommand: {command}"

    def _ask(fmt):
        payload = {
            "model": config.MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
        }
        if fmt:
            payload["format"] = "json"  # Ollama's JSON mode; not supported by very old builds
        return requests.post(config.OLLAMA_URL, json=payload, timeout=30)

    try:
        response = _ask(fmt=True)
        response.raise_for_status()
        content = response.json()["message"]["content"]
    except requests.exceptions.ConnectionError:
        return None  # Ollama down - caller explains
    except Exception:
        try:  # retry without JSON mode in case this Ollama build doesn't support it
            response = _ask(fmt=False)
            response.raise_for_status()
            content = response.json()["message"]["content"]
        except Exception:
            return None
    return _parse_llm_json(content)


def _parse_llm_json(content):
    """Dig the reminder out of whatever the model returned (it may wrap the JSON
    in fences or add a line of prose). Returns (text, datetime) or None."""
    text = content.strip()
    if "```" in text:
        text = text.split("```")[1] if "```" in text.replace("```", "", 1) else text
        text = text.lstrip("json").strip()
    try:
        start, end = text.index("{"), text.rindex("}")
        data = json.loads(text[start:end + 1])
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None

    reminder_text = next((data[k] for k in ("text", "reminder_text", "content")
                          if isinstance(data.get(k), str) and data[k].strip()), None)
    trigger_str = next((data[k] for k in ("trigger_datetime", "trigger", "when", "datetime")
                        if isinstance(data.get(k), str) and data[k].strip()), None)
    if not reminder_text or not trigger_str:
        return None

    try:
        trigger = datetime.datetime.fromisoformat(trigger_str.strip().replace(" ", "T"))
    except ValueError:
        return None
    if trigger <= datetime.datetime.now():
        return None  # the model produced something in the past - don't trust it
    return reminder_text.strip(), trigger


# ---------- persistence (same pattern as memory.json) ----------

def add_reminder(text, trigger):
    REMINDERS.append({
        "text": text,
        "trigger_iso": trigger.isoformat(timespec="seconds"),
        "created_at": datetime.datetime.now().isoformat(timespec="seconds"),
    })
    save_reminders()


def load_reminders():
    global REMINDERS
    REMINDERS = []
    if not os.path.exists(REMINDERS_PATH):
        return
    try:
        with open(REMINDERS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        now = datetime.datetime.now()
        kept = [r for r in (data if isinstance(data, list) else [])
                if _parse_trigger(r) is not None and _parse_trigger(r) > now]
        REMINDERS = kept
        if len(kept) != (len(data) if isinstance(data, list) else 0):
            save_reminders()  # prune stale entries from disk
    except Exception as e:
        push_history(f"(reminders couldn't be loaded: {e})")
        REMINDERS = []


def save_reminders():
    try:
        with open(REMINDERS_PATH, "w", encoding="utf-8") as f:
            json.dump(REMINDERS, f, indent=2)
    except Exception as e:
        push_history(f"(reminders save error: {e})")


def _parse_trigger(reminder):
    try:
        return datetime.datetime.fromisoformat(reminder["trigger_iso"])
    except (KeyError, ValueError, TypeError):
        return None


# ---------- scheduler thread ----------

def start_scheduler():
    global _scheduler_started
    if _scheduler_started:
        return
    _scheduler_started = True
    threading.Thread(target=_scheduler_loop, daemon=True).start()


def _fire_due():
    """Speak any reminders whose trigger has passed. Returns how many fired."""
    now = datetime.datetime.now()
    due = [r for r in list(REMINDERS) if _parse_trigger(r) is not None and _parse_trigger(r) <= now]
    for r in due:
        REMINDERS.remove(r)
        tts.speak(persona.REMINDER_FIRE.format(text=r["text"]))
    if due:
        save_reminders()
    return len(due)


def _scheduler_loop():
    while not stop_flag.is_set():
        _fire_due()
        stop_flag.wait(SCHEDULER_TICK_SECONDS)  # wait() also exits immediately on stop


# ---------- command routing ----------

def _format_when(trigger):
    """A human-friendly 'at 3:30 PM' / 'tomorrow at 8 AM' / 'on August 5 at 6 PM'."""
    now = datetime.datetime.now()
    clock = trigger.strftime("%I:%M %p").lstrip("0")
    if trigger.date() == now.date():
        return f"at {clock}"
    if trigger.date() == (now + datetime.timedelta(days=1)).date():
        return f"tomorrow at {clock}"
    return f"on {trigger.strftime('%B %d')} at {clock}"


def _list_reminders():
    if not REMINDERS:
        return persona.REPLY_REMINDERS_NONE
    parts = []
    for r in sorted(REMINDERS, key=lambda r: r["trigger_iso"]):
        trigger = _parse_trigger(r) or datetime.datetime.min
        parts.append(f"{r['text']} {_format_when(trigger)}")
    return persona.REPLY_REMINDERS_LIST.format(
        count=len(parts), s="" if len(parts) == 1 else "s", items="; ".join(parts))


def _clear_reminders():
    global REMINDERS
    n = len(REMINDERS)
    REMINDERS = []
    save_reminders()
    return persona.REPLY_REMINDERS_CLEARED if n else persona.REPLY_REMINDERS_NONE


def handle_reminder_command(command):
    """Route a reminder-related command and return the line to speak. The
    dispatcher only calls this when the utterance mentions a reminder/alarm,
    so a reply is always produced - never a silent fall-through."""
    c = command.lower().strip()

    if ("cancel" in c and ("reminder" in c or "alarm" in c)) or \
            "clear reminders" in c or "delete reminders" in c or "remove reminders" in c:
        return _clear_reminders()

    if "what reminders" in c or "list reminders" in c or "show reminders" in c:
        return _list_reminders()

    parsed = parse_reminder_command(command)
    if parsed is None:
        parsed = _llm_extract_reminder(command)
    if parsed is None:
        return persona.REPLY_REMINDER_UNPARSEABLE

    text, trigger = parsed
    add_reminder(text, trigger)
    return persona.REPLY_REMINDER_SET.format(text=text, when=_format_when(trigger))
