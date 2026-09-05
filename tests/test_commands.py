"""Command routing + the destructive-action confirmation flow. Every side
effecting call is stubbed so tests never launch apps, open windows, change
volume, or touch the real Desktop."""

import re

import pytest

from jarvis import memory, persona, tts, voice
from jarvis.commands import dispatcher, files, media, system


def _fail(*args, **kwargs):
    raise AssertionError("a real side effect fired during the test")


# ---------- destructive-action confirmation flow ----------

def test_shutdown_sets_confirmation(isolated_memory, monkeypatch):
    monkeypatch.setattr(dispatcher.os, "system", _fail)  # must NOT run shutdown
    reply = dispatcher.try_fixed_command("shut down")
    assert reply == persona.CONFIRM_SHUTDOWN
    assert dispatcher.PENDING_CONFIRM == {"action": "shutdown", "arg": None}


def test_restart_sets_confirmation(isolated_memory, monkeypatch):
    monkeypatch.setattr(dispatcher.os, "system", _fail)
    reply = dispatcher.try_fixed_command("restart the pc")
    assert "restart" in reply.lower()
    assert dispatcher.PENDING_CONFIRM["action"] == "restart"


def test_cancel_shutdown_runs_shutdown_abort(isolated_memory, monkeypatch):
    calls = []
    monkeypatch.setattr(dispatcher.os, "system", lambda cmd: calls.append(cmd))
    reply = dispatcher.try_fixed_command("cancel shutdown")
    assert reply == persona.REPLY_ABORT_POWER
    assert calls == ["shutdown /a"]


def test_delete_sets_confirmation_with_name(isolated_memory, monkeypatch):
    monkeypatch.setattr(dispatcher.os, "system", _fail)
    reply = dispatcher.try_fixed_command("delete notes.txt")
    assert dispatcher.PENDING_CONFIRM == {"action": "delete", "arg": "notes.txt"}
    assert "notes.txt" in reply


def test_confirm_flow_executes_pending_delete(isolated_memory, monkeypatch):
    spoken = []
    deleted = []
    monkeypatch.setattr(tts, "speak", lambda text: spoken.append(text))
    monkeypatch.setattr(dispatcher.os, "system", _fail)
    monkeypatch.setattr(files, "delete_item", lambda name: deleted.append(name) or f"Deleted {name}.")
    dispatcher.PENDING_CONFIRM = {"action": "delete", "arg": "test.txt"}

    assert voice.handle_command("yes") is True
    assert deleted == ["test.txt"]
    assert spoken == ["Deleted test.txt."]
    assert dispatcher.PENDING_CONFIRM == {"action": None, "arg": None}


def test_deny_confirmation_cancels(isolated_memory, monkeypatch):
    spoken = []
    monkeypatch.setattr(tts, "speak", lambda text: spoken.append(text))
    monkeypatch.setattr(dispatcher.os, "system", _fail)  # shutdown must never run
    dispatcher.PENDING_CONFIRM = {"action": "shutdown", "arg": None}

    assert voice.handle_command("no") is True
    assert spoken == [persona.REPLY_CANCEL]


def test_exit_phrase_stops_assistant(isolated_memory, monkeypatch):
    spoken = []
    monkeypatch.setattr(tts, "speak", lambda text: spoken.append(text))
    assert voice.handle_command("goodbye") is False
    assert spoken == [persona.REPLY_GOODBYE]


# ---------- memory commands ----------

def test_remember_appends_fact_and_recalls(isolated_memory, monkeypatch):
    monkeypatch.setattr(memory, "save_memory", lambda: None)
    reply = dispatcher.try_fixed_command("remember that I like tea")
    assert reply == persona.REPLY_REMEMBER.format(fact="I like tea")
    assert memory.FACTS == ["I like tea"]

    reply = dispatcher.try_fixed_command("what do you remember")
    assert reply == "Here's what I remember: I like tea"


def test_forget_everything_clears_facts(isolated_memory, monkeypatch):
    memory.FACTS = ["one", "two"]
    monkeypatch.setattr(memory, "save_memory", lambda: None)
    reply = dispatcher.try_fixed_command("forget everything")
    assert reply == persona.REPLY_FORGET_ALL
    assert memory.FACTS == []


# ---------- pure string outputs ----------

def test_time_and_date_format(isolated_memory):
    t = dispatcher.try_fixed_command("what time is it")
    assert re.fullmatch(r"It's \d{1,2}:\d{2} [AP]M", t)
    d = dispatcher.try_fixed_command("what's the date")
    assert d.startswith("Today is ")


# ---------- routing to leaf actions (side effects stubbed) ----------

def test_route_open_notepad(isolated_memory, monkeypatch):
    calls = []
    monkeypatch.setattr(system.subprocess, "Popen", lambda *a, **k: calls.append(a))
    reply = dispatcher.try_fixed_command("open notepad")
    assert reply == "Opening Notepad."
    assert calls and "notepad.exe" in calls[0][0]


def test_route_set_volume(isolated_memory, monkeypatch):
    calls = []
    monkeypatch.setattr(system, "set_volume", lambda p: calls.append(p) or "<stub>")
    reply = dispatcher.try_fixed_command("set volume to 50")
    assert calls == ["50"]
    assert reply == "<stub>"


def test_route_media_next(isolated_memory, monkeypatch):
    calls = []
    monkeypatch.setattr(media, "media_next", lambda: calls.append(1) or "<stub>")
    reply = dispatcher.try_fixed_command("next song")
    assert calls == [1]
    assert reply == "<stub>"


def test_route_create_file(isolated_memory, monkeypatch):
    calls = []
    monkeypatch.setattr(files, "create_file", lambda name: calls.append(name) or "<stub>")
    dispatcher.try_fixed_command("create a file called hello.txt")
    assert calls == ["hello.txt"]


def test_route_web_shortcut(isolated_memory, monkeypatch):
    opened = []
    monkeypatch.setattr(dispatcher.webbrowser, "open", lambda url: opened.append(url))
    reply = dispatcher.try_fixed_command("open youtube")
    assert opened == ["https://youtube.com"]
    assert reply == "Opening Youtube."


# ---------- fall-through ----------

def test_unmatched_question_falls_through(isolated_memory):
    assert dispatcher.try_fixed_command("what is the capital of france") is None


def test_action_hint_detects_unmatched_actions(isolated_memory):
    assert dispatcher.sounds_like_unmatched_action("open the refrigerator") is True
    assert dispatcher.sounds_like_unmatched_action("tell me a joke") is False
