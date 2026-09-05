"""Calendar: the shared 'when' parser (reminders.parse_when_phrase), add-event
parsing, persistence, read routing with the Outlook-unavailable fallback, and
dispatcher wiring. Outlook/LLM are stubbed so tests never touch COM or Ollama;
file writes go to a throwaway path."""

import datetime
import json

import pytest

from jarvis import calendar, memory, persona, reminders
from jarvis.commands import dispatcher


@pytest.fixture
def isolated_calendar(tmp_path, monkeypatch):
    monkeypatch.setattr(calendar, "CALENDAR_PATH", str(tmp_path / "calendar.json"))
    monkeypatch.setattr(calendar, "EVENTS", [])
    monkeypatch.setattr(calendar, "_read_outlook_day", lambda day: ([], "unavailable"))
    monkeypatch.setattr(calendar, "_llm_extract_event", lambda command: None)
    yield
    monkeypatch.setattr(calendar, "EVENTS", [])


def _hours_later(hours):
    return datetime.datetime.now() + datetime.timedelta(hours=hours)


# ---------- shared 'when' parser (also used by reminders) ----------

def test_when_duration_minutes():
    when = reminders.parse_when_phrase("in 20 minutes")
    delta = when - datetime.datetime.now()
    assert datetime.timedelta(minutes=19, seconds=50) < delta < datetime.timedelta(minutes=20, seconds=10)


def test_when_tomorrow_at_time():
    when = reminders.parse_when_phrase("tomorrow at 3pm")
    assert isinstance(when, datetime.datetime)
    assert when.hour == 15 and when.minute == 0
    assert when.date() == datetime.date.today() + datetime.timedelta(days=1)


def test_when_today_at_time():
    when = reminders.parse_when_phrase("today at 5pm")
    assert when.hour == 17 and when.minute == 0
    assert when.date() == datetime.date.today()


def test_when_bare_clock_time():
    when = reminders.parse_when_phrase("at 3pm")
    assert when.hour == 15 and when.minute == 0
    # "at 3pm" means today, or tomorrow if that time already passed
    assert when.date() in (datetime.date.today(),
                           datetime.date.today() + datetime.timedelta(days=1))


def test_when_all_day_tomorrow_returns_date():
    when = reminders.parse_when_phrase("tomorrow")
    assert isinstance(when, datetime.date) and not isinstance(when, datetime.datetime)
    assert when == datetime.date.today() + datetime.timedelta(days=1)


def test_when_weekday_is_future():
    when = reminders.parse_when_phrase("monday at 9am")
    assert isinstance(when, datetime.datetime)
    assert when.hour == 9 and when.weekday() == 0
    assert when > datetime.datetime.now()  # never in the past


def test_when_month_day():
    when = reminders.parse_when_phrase("on august 5 at 6pm")
    assert isinstance(when, datetime.datetime)
    assert when.month == 8 and when.day == 5 and when.hour == 18
    assert when > datetime.datetime.now()  # rolls to next year if passed


def test_when_garbage_returns_none():
    assert reminders.parse_when_phrase("sometime maybe") is None
    assert reminders.parse_when_phrase("") is None
    assert reminders.parse_when_phrase(None) is None


# ---------- add-event parsing ----------

def test_parse_add_event_colon():
    text, when = calendar.parse_add_event_command("add an event: dentist tomorrow at 3pm")
    assert text == "dentist"
    assert when.hour == 15 and when.date() == datetime.date.today() + datetime.timedelta(days=1)


def test_parse_add_event_no_colon():
    text, when = calendar.parse_add_event_command("add an event dentist tomorrow at 3pm")
    assert text == "dentist"


def test_parse_schedule_verb():
    text, when = calendar.parse_add_event_command("schedule dentist tomorrow at 3pm")
    assert text == "dentist"
    assert when.hour == 15


def test_parse_add_all_day():
    text, when = calendar.parse_add_event_command("add an event: dentist tomorrow")
    assert text == "dentist"
    assert isinstance(when, datetime.date) and not isinstance(when, datetime.datetime)


def test_parse_no_when_returns_none(isolated_calendar):
    assert calendar.parse_add_event_command("add an event dentist") is None


# ---------- persistence (survives a restart) ----------

def test_add_event_and_round_trip(isolated_calendar):
    calendar.add_event("dentist", _hours_later(3))
    calendar.EVENTS = []  # simulate a restart
    calendar.load_calendar()
    assert len(calendar.EVENTS) == 1
    assert calendar.EVENTS[0]["text"] == "dentist"
    assert calendar.EVENTS[0]["all_day"] is False


def test_add_all_day_event_round_trip(isolated_calendar):
    calendar.add_event("holiday", datetime.date.today() + datetime.timedelta(days=1))
    calendar.EVENTS = []
    calendar.load_calendar()
    assert calendar.EVENTS[0]["all_day"] is True


def test_load_drops_garbage_entries(isolated_calendar):
    with open(calendar.CALENDAR_PATH, "w", encoding="utf-8") as f:
        json.dump({"events": [
            {"text": "good", "when_iso": _hours_later(1).isoformat(), "all_day": False},
            {"text": "bad", "when_iso": "not-a-date", "all_day": False},
        ]}, f)
    calendar.load_calendar()
    assert [e["text"] for e in calendar.EVENTS] == ["good"]


# ---------- reading (Outlook watchdog) ----------
# These exercise the real _read_outlook_day (the isolated_calendar fixture
# stubs it out, so they use a bare monkeypatch instead).

def test_read_outlook_returns_worker_result(monkeypatch):
    events = [{"subject": "Dentist", "start": datetime.datetime.now().replace(hour=12), "all_day": False}]
    monkeypatch.setattr(calendar, "_read_outlook_now", lambda day: (events, "ok"))
    assert calendar._read_outlook_day(datetime.date.today()) == (events, "ok")


def test_read_outlook_times_out_and_falls_back(monkeypatch):
    import time

    def hang(day):
        time.sleep(5)  # longer than the watchdog, so it abandons the worker
        return [{"subject": "late", "start": datetime.datetime.now(), "all_day": False}], "ok"

    monkeypatch.setattr(calendar, "_read_outlook_now", hang)
    monkeypatch.setattr(calendar, "_OUTLOOK_TIMEOUT_SECONDS", 0.05)
    events, state = calendar._read_outlook_day(datetime.date.today())
    assert state == "unavailable"
    assert events == []


# ---------- reading (Outlook fallback) ----------

def test_read_empty_uses_local_fallback_message(isolated_calendar):
    reply = calendar.handle_calendar_command("what's on my calendar")
    assert persona.CALENDAR_OUTLOOK_UNAVAILABLE in reply
    assert "nothing scheduled" in reply


def test_read_local_events_after_outlook_fallback(isolated_calendar):
    calendar.add_event("dentist", _hours_later(3))
    reply = calendar.handle_calendar_command("what's on my calendar")
    assert persona.CALENDAR_OUTLOOK_UNAVAILABLE in reply
    assert "dentist" in reply


def test_read_outlook_events_when_available(isolated_calendar, monkeypatch):
    start = datetime.datetime.now().replace(hour=14, minute=30, second=0, microsecond=0)
    monkeypatch.setattr(calendar, "_read_outlook_day",
                        lambda day: ([{"subject": "Standup", "start": start, "all_day": False}], "ok"))
    reply = calendar.handle_calendar_command("what's on my schedule today")
    assert "Outlook" in reply
    assert "Standup" in reply


def test_read_not_calendar_command_returns_none(isolated_calendar):
    assert calendar.handle_calendar_command("what's the time") is None


# ---------- adding through the handler ----------

def test_handle_add_event_confirms_and_stores(isolated_calendar):
    reply = calendar.handle_calendar_command("add an event: dentist tomorrow at 3pm")
    assert "dentist" in reply
    assert len(calendar.EVENTS) == 1


def test_handle_add_unparseable_explains(isolated_calendar):
    reply = calendar.handle_calendar_command("add an event thingamajig")
    assert reply == persona.REPLY_EVENT_UNPARSEABLE
    assert calendar.EVENTS == []


# ---------- dispatcher routing ----------

def test_dispatcher_routes_whats_on(isolated_memory, isolated_calendar):
    reply = dispatcher.try_fixed_command("what's on my calendar")
    assert reply is not None
    assert "nothing scheduled" in reply


def test_dispatcher_routes_add_event(isolated_memory, isolated_calendar):
    reply = dispatcher.try_fixed_command("add an event: dentist tomorrow at 3pm")
    assert "dentist" in reply
    assert len(calendar.EVENTS) == 1


def test_dispatcher_schedule_word_falls_through_when_not_calendar(isolated_memory, isolated_calendar, monkeypatch):
    # "cancel the scheduled shutdown" must not become a calendar command
    monkeypatch.setattr(dispatcher.os, "system", lambda cmd: None)
    assert dispatcher.try_fixed_command("cancel the scheduled shutdown") == persona.REPLY_ABORT_POWER
