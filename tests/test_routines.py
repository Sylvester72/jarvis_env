"""Routines: recording mode, matching, management, persistence, and the
replay path through the normal command handler - including the hard rule that
a destructive action inside a routine still asks for confirmation and never
auto-runs. Side effects are stubbed; routine files go to a throwaway path."""

import pytest

from jarvis import memory, persona, routines, tts, voice
from jarvis.commands import dispatcher, system


@pytest.fixture
def isolated_routines(tmp_path, monkeypatch):
    monkeypatch.setattr(routines, "ROUTINES_PATH", str(tmp_path / "routines.json"))
    monkeypatch.setattr(routines, "ROUTINES", {})
    monkeypatch.setattr(routines, "_recording_name", None)
    monkeypatch.setattr(routines, "_recording_commands", [])
    monkeypatch.setattr(voice, "_active_routine_stack", [])
    yield
    monkeypatch.setattr(routines, "ROUTINES", {})
    monkeypatch.setattr(routines, "_recording_name", None)
    monkeypatch.setattr(routines, "_recording_commands", [])


# ---------- recording mode ----------

def test_recording_flow_saves_named_routine(isolated_routines):
    assert routines.match_start_recording("learn this as morning") == "morning"
    routines.start_recording("morning")
    assert routines.is_recording()
    reply = routines.capture_for_recording("open notepad")
    assert "1 command" in reply
    routines.capture_for_recording("set volume to 30")
    reply = routines.capture_for_recording("that's the routine")
    assert "morning" in reply
    assert routines.is_recording() is False
    assert routines.ROUTINES == {"morning": ["open notepad", "set volume to 30"]}


def test_recording_cancel_discards(isolated_routines):
    routines.start_recording("morning")
    routines.capture_for_recording("open notepad")
    reply = routines.capture_for_recording("cancel the routine")
    assert "discarded" in reply
    assert routines.ROUTINES == {}


def test_empty_routine_not_saved(isolated_routines):
    routines.start_recording("morning")
    reply = routines.capture_for_recording("that's the routine")
    assert "empty" in reply
    assert routines.ROUTINES == {}


# ---------- matching ----------

def test_match_start_recording_phrasings(isolated_routines):
    assert routines.match_start_recording("learn this as work mode") == "work mode"
    assert routines.match_start_recording("record this as work mode") == "work mode"
    assert routines.match_start_recording("create a routine called work mode") == "work mode"
    assert routines.match_start_recording("start recording work mode") == "work mode"
    assert routines.match_start_recording("learn my voice") is None  # must not collide with voice enrollment


def test_match_run_routine_known_and_unknown(isolated_routines):
    routines.ROUTINES = {"morning": ["open notepad"]}
    assert routines.match_run_routine("do morning") == "morning"
    assert routines.match_run_routine("run morning") == "morning"
    assert routines.match_run_routine("do the morning") == "morning"
    assert routines.match_run_routine("run the morning routine") == "morning"
    assert routines.match_run_routine("do nothing") is None
    assert routines.match_run_routine("do you know the time") is None  # 'do' prefix alone is never enough


def test_manage_list_and_delete(isolated_routines):
    routines.ROUTINES = {"morning": ["open notepad"], "night": ["mute"]}
    reply = routines.match_manage_routines("list routines")
    assert "morning" in reply and "night" in reply
    reply = routines.match_manage_routines("delete routine morning")
    assert "deleted" in reply
    assert routines.ROUTINES == {"night": ["mute"]}


def test_manage_clear_routines(isolated_routines):
    routines.ROUTINES = {"morning": ["open notepad"]}
    routines.match_manage_routines("clear routines")
    assert routines.ROUTINES == {}


# ---------- persistence ----------

def test_round_trip(isolated_routines):
    routines.ROUTINES = {"morning": ["open notepad", "set volume to 30"]}
    routines.save_routines()
    routines.ROUTINES = {}
    routines.load_routines()
    assert routines.ROUTINES == {"morning": ["open notepad", "set volume to 30"]}


# ---------- replay through the normal command handler ----------

def test_replay_runs_commands_in_order(isolated_memory, isolated_routines, monkeypatch):
    spoken = []
    calls = []
    monkeypatch.setattr(tts, "speak", lambda text: spoken.append(text))
    monkeypatch.setattr(system.subprocess, "Popen", lambda *a, **k: calls.append(a))
    routines.ROUTINES = {"morning": ["open notepad", "open calculator"]}
    reply = voice._run_routine("morning")
    assert reply == persona.REPLY_ROUTINE_DONE.format(name="morning", count=2)
    assert "notepad.exe" in calls[0][0]
    assert "calc.exe" in calls[1][0]


def test_do_replays_routine(isolated_memory, isolated_routines, monkeypatch):
    spoken = []
    calls = []
    monkeypatch.setattr(tts, "speak", lambda text: spoken.append(text))
    monkeypatch.setattr(system.subprocess, "Popen", lambda *a, **k: calls.append(a))
    routines.ROUTINES = {"morning": ["open notepad"]}
    assert voice.handle_command("do morning") is True
    assert "notepad.exe" in calls[0][0]


def test_recording_intercepts_commands_instead_of_executing(isolated_memory, isolated_routines, monkeypatch):
    spoken = []
    monkeypatch.setattr(tts, "speak", lambda text: spoken.append(text))
    # no side effect may fire while recording
    monkeypatch.setattr(dispatcher.os, "system", lambda *a, **k: (_ for _ in ()).throw(
        AssertionError("must not execute while recording")))
    routines.start_recording("morning")
    assert voice.handle_command("shut down") is True
    assert dispatcher.PENDING_CONFIRM == {"action": None, "arg": None}
    assert routines._recording_commands == ["shut down"]


def test_learn_this_as_starts_recording(isolated_memory, isolated_routines, monkeypatch):
    spoken = []
    monkeypatch.setattr(tts, "speak", lambda text: spoken.append(text))
    assert voice.handle_command("learn this as morning routine") is True
    assert routines.is_recording()
    assert routines.recording_name() == "morning routine"
    assert spoken == [persona.REPLY_ROUTINE_START.format(name="morning routine")]


def test_routine_loop_guard(isolated_memory, isolated_routines, monkeypatch):
    spoken = []
    monkeypatch.setattr(tts, "speak", lambda text: spoken.append(text))
    routines.ROUTINES = {"loop": ["do loop"]}
    voice._run_routine("loop")  # must terminate, not recurse forever
    assert persona.REPLY_ROUTINE_LOOP in spoken


# ---------- the hard rule: destructive actions still confirm ----------

def test_routine_replay_asks_confirmation_and_never_auto_runs(isolated_memory, isolated_routines, monkeypatch):
    spoken = []
    monkeypatch.setattr(tts, "speak", lambda text: spoken.append(text))
    # the shutdown executable must never be invoked by the replay itself
    monkeypatch.setattr(dispatcher.os, "system", lambda *a, **k: (_ for _ in ()).throw(
        AssertionError("shutdown must not run without the user's yes")))
    routines.ROUTINES = {"danger": ["shut down the pc"]}

    reply = voice._run_routine("danger")
    assert reply == persona.REPLY_ROUTINE_AWAITING_CONFIRM
    assert dispatcher.PENDING_CONFIRM["action"] == "shutdown"
    # the routine spoke the normal confirmation prompt - not the action
    assert persona.CONFIRM_SHUTDOWN in spoken

    # answering "no" cancels, exactly like a live command
    assert voice.handle_command("no") is True
    assert dispatcher.PENDING_CONFIRM == {"action": None, "arg": None}


def test_routine_destructive_action_confirms_then_executes(isolated_memory, isolated_routines, monkeypatch):
    spoken = []
    cmds = []
    monkeypatch.setattr(tts, "speak", lambda text: spoken.append(text))
    monkeypatch.setattr(dispatcher.os, "system", lambda cmd: cmds.append(cmd))
    routines.ROUTINES = {"danger": ["shut down the pc"]}

    voice._run_routine("danger")
    assert dispatcher.PENDING_CONFIRM["action"] == "shutdown"
    assert cmds == []  # nothing ran before the user answered

    assert voice.handle_command("yes") is True
    assert cmds == ["shutdown /s /t 5"]
