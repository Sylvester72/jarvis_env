"""Reminder parsing, persistence, the due-fire scheduler, and dispatcher
routing. The LLM fallback is stubbed so tests never hit Ollama; file writes go
to a throwaway path so the real data/ folder is untouched."""

import datetime
import json

import pytest

from jarvis import memory, persona, reminders, tts
from jarvis.commands import dispatcher


@pytest.fixture
def isolated_reminders(tmp_path, monkeypatch):
    monkeypatch.setattr(reminders, "REMINDERS_PATH", str(tmp_path / "reminders.json"))
    monkeypatch.setattr(reminders, "REMINDERS", [])
    monkeypatch.setattr(reminders, "_llm_extract_reminder", lambda command: None)
    yield
    monkeypatch.setattr(reminders, "REMINDERS", [])


# ---------- regex fast-path parsing ----------

def test_parse_duration_minutes():
    text, trigger = reminders.parse_reminder_command("remind me to call mom in 10 minutes")
    assert text == "call mom"
    delta = trigger - datetime.datetime.now()
    assert datetime.timedelta(minutes=9, seconds=50) < delta < datetime.timedelta(minutes=10, seconds=10)


def test_parse_duration_hours():
    text, trigger = reminders.parse_reminder_command("remind me to drink water in 2 hours")
    assert text == "drink water"
    delta = trigger - datetime.datetime.now()
    assert datetime.timedelta(hours=1, minutes=59) < delta < datetime.timedelta(hours=2, minutes=1)


def test_parse_duration_singular_units():
    text, trigger = reminders.parse_reminder_command("remind me to stretch in a minute")
    assert text == "stretch"
    delta = trigger - datetime.datetime.now()
    assert delta < datetime.timedelta(minutes=1, seconds=5)


def test_parse_duration_reverse_order():
    text, trigger = reminders.parse_reminder_command("remind me in 5 minutes to take a break")
    assert text == "take a break"
    delta = trigger - datetime.datetime.now()
    assert datetime.timedelta(minutes=4, seconds=50) < delta < datetime.timedelta(minutes=5, seconds=10)


def test_parse_clock_time_pm():
    text, trigger = reminders.parse_reminder_command("remind me to feed the cat at 3pm")
    assert text == "feed the cat"
    assert trigger.hour == 15 and trigger.minute == 0


def test_parse_clock_time_24h():
    text, trigger = reminders.parse_reminder_command("remind me to call the bank at 15:30")
    assert text == "call the bank"
    assert trigger.hour == 15 and trigger.minute == 30


def test_parse_clock_time_rolls_to_tomorrow_when_past(isolated_reminders, monkeypatch):
    now = datetime.datetime.now().replace(second=0, microsecond=0)
    past_time = (now - datetime.timedelta(hours=2)).strftime("%H:%M")
    _, trigger = reminders.parse_reminder_command(f"remind me to go to bed at {past_time}")
    assert trigger > datetime.datetime.now()  # never fires in the past
    assert trigger.date() != datetime.datetime.now().date()


def test_parse_alarm():
    text, trigger = reminders.parse_reminder_command("set an alarm at 7am")
    assert text == "your alarm"
    assert trigger.hour == 7 and trigger.minute == 0


def test_parse_unparseable_returns_none(isolated_reminders):
    assert reminders.parse_reminder_command("remind me about the thing tomorrow-ish") is None


# ---------- persistence (survives a restart, future triggers only) ----------

def test_add_and_round_trip(isolated_reminders):
    trigger = datetime.datetime.now() + datetime.timedelta(hours=1)
    reminders.add_reminder("call mom", trigger)
    reminders.REMINDERS = []  # simulate a restart
    reminders.load_reminders()
    assert len(reminders.REMINDERS) == 1
    assert reminders.REMINDERS[0]["text"] == "call mom"


def test_load_drops_stale_reminders(isolated_reminders):
    past = datetime.datetime.now() - datetime.timedelta(minutes=5)
    future = datetime.datetime.now() + datetime.timedelta(hours=1)
    reminders.REMINDERS = [
        {"text": "stale", "trigger_iso": past.isoformat(), "created_at": ""},
        {"text": "still valid", "trigger_iso": future.isoformat(), "created_at": ""},
    ]
    reminders.save_reminders()
    reminders.REMINDERS = []
    reminders.load_reminders()
    assert [r["text"] for r in reminders.REMINDERS] == ["still valid"]


# ---------- scheduler: due reminders fire through speak() ----------

def test_fire_due_speaks_and_removes(isolated_reminders, monkeypatch):
    spoken = []
    monkeypatch.setattr(tts, "speak", lambda text: spoken.append(text))
    past = datetime.datetime.now() - datetime.timedelta(seconds=5)
    future = datetime.datetime.now() + datetime.timedelta(hours=2)
    reminders.REMINDERS = [
        {"text": "stretch", "trigger_iso": past.isoformat(), "created_at": ""},
        {"text": "later", "trigger_iso": future.isoformat(), "created_at": ""},
    ]
    n = reminders._fire_due()
    assert n == 1
    assert spoken == [persona.REMINDER_FIRE.format(text="stretch")]
    assert [r["text"] for r in reminders.REMINDERS] == ["later"]


# ---------- command routing ----------

def test_handle_set_reminder_returns_confirmation(isolated_reminders):
    reply = reminders.handle_reminder_command("remind me to call mom in 30 minutes")
    assert "call mom" in reply
    assert len(reminders.REMINDERS) == 1


def test_handle_list_reminders(isolated_reminders):
    trigger = datetime.datetime.now() + datetime.timedelta(hours=1)
    reminders.add_reminder("call mom", trigger)
    reply = reminders.handle_reminder_command("what reminders are set")
    assert "call mom" in reply


def test_handle_clear_reminders(isolated_reminders):
    trigger = datetime.datetime.now() + datetime.timedelta(hours=1)
    reminders.add_reminder("call mom", trigger)
    reply = reminders.handle_reminder_command("cancel reminders")
    assert "cleared" in reply
    assert reminders.REMINDERS == []


def test_handle_unparseable_explains(isolated_reminders):
    reply = reminders.handle_reminder_command("remind me about the thing tomorrow-ish")
    assert reply == persona.REPLY_REMINDER_UNPARSEABLE
    assert reminders.REMINDERS == []


# ---------- dispatcher routing ----------

def test_dispatcher_routes_reminder(isolated_memory, isolated_reminders):
    reply = dispatcher.try_fixed_command("remind me to call mom in 30 minutes")
    assert "call mom" in reply
    assert dispatcher.PENDING_CONFIRM == {"action": None, "arg": None}


def test_remind_to_shut_down_is_not_a_shutdown(isolated_memory, isolated_reminders, monkeypatch):
    # "remind me to shut down in 5 minutes" must set a reminder - it must NOT
    # arm the shutdown confirmation. This is the ordering regression test.
    monkeypatch.setattr(dispatcher.os, "system", lambda *a, **k: (_ for _ in ()).throw(
        AssertionError("shutdown must never be armed")))
    reply = dispatcher.try_fixed_command("remind me to shut down in 5 minutes")
    assert "Reminder set" in reply
    assert dispatcher.PENDING_CONFIRM == {"action": None, "arg": None}
    assert len(reminders.REMINDERS) == 1


def test_cancel_shutdown_still_aborts(isolated_memory, isolated_reminders, monkeypatch):
    calls = []
    monkeypatch.setattr(dispatcher.os, "system", lambda cmd: calls.append(cmd))
    reply = dispatcher.try_fixed_command("cancel shutdown")
    assert reply == persona.REPLY_ABORT_POWER
    assert calls == ["shutdown /a"]
