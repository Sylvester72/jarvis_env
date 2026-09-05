"""Proactive awareness: battery/disk conditions trip an alert exactly once and
stay quiet until the condition clears and re-triggers. Battery is skipped
gracefully on desktops (sensors_battery() returns None). Also covers the
service checks (Ollama / microphone / internet) and their probes."""

import pytest

import psutil
import requests
import sounddevice

from jarvis import awareness, persona, tts


@pytest.fixture
def isolated_awareness(monkeypatch):
    monkeypatch.setattr(awareness, "_active", set())
    yield
    monkeypatch.setattr(awareness, "_active", set())


class _FakeBattery:
    def __init__(self, percent):
        self.percent = percent


class _FakeUsage:
    def __init__(self, total, free):
        self.total = total
        self.free = free


def _spoken(monkeypatch):
    out = []
    monkeypatch.setattr(tts, "speak", lambda text: out.append(text))
    return out


# ---------- battery ----------

def test_battery_low_alerts_once_then_clears_and_realerts(isolated_awareness, monkeypatch):
    spoken = _spoken(monkeypatch)
    monkeypatch.setattr(awareness, "_check_disk", lambda: None)
    low = lambda: _FakeBattery(14)
    monkeypatch.setattr(psutil, "sensors_battery", low)

    # first crossing -> speaks once
    assert awareness.check_health() == [persona.ALERT_BATTERY.format(percent=14)]
    assert spoken == [persona.ALERT_BATTERY.format(percent=14)]

    # still low -> silent (no nagging)
    spoken.clear()
    assert awareness.check_health() == []
    assert spoken == []

    # recovers -> re-arms silently
    monkeypatch.setattr(psutil, "sensors_battery", lambda: _FakeBattery(80))
    assert awareness.check_health() == []
    assert spoken == []

    # dips again -> re-alerts
    monkeypatch.setattr(psutil, "sensors_battery", lambda: _FakeBattery(9))
    assert awareness.check_health() == [persona.ALERT_BATTERY.format(percent=9)]


def test_battery_none_on_desktop_is_quiet(isolated_awareness, monkeypatch):
    spoken = _spoken(monkeypatch)
    monkeypatch.setattr(awareness, "_check_disk", lambda: None)
    monkeypatch.setattr(psutil, "sensors_battery", lambda: None)  # no battery present
    assert awareness.check_health() == []
    assert spoken == []


def test_battery_above_threshold_is_quiet(isolated_awareness, monkeypatch):
    spoken = _spoken(monkeypatch)
    monkeypatch.setattr(awareness, "_check_disk", lambda: None)
    monkeypatch.setattr(psutil, "sensors_battery", lambda: _FakeBattery(60))
    assert awareness.check_health() == []
    assert spoken == []


# ---------- disk ----------

def test_disk_low_alerts_once(isolated_awareness, monkeypatch):
    spoken = _spoken(monkeypatch)
    monkeypatch.setattr(awareness, "_check_battery", lambda: None)
    monkeypatch.setattr(awareness, "_main_drive", lambda: "C:\\")
    monkeypatch.setattr(psutil, "disk_usage", lambda path: _FakeUsage(total=100_000, free=5_000))  # 5% free
    assert awareness.check_health() == [persona.ALERT_DISK.format(free=5)]
    assert spoken == [persona.ALERT_DISK.format(free=5)]

    # still low -> silent
    spoken.clear()
    assert awareness.check_health() == []
    assert spoken == []


def test_disk_healthy_is_quiet(isolated_awareness, monkeypatch):
    spoken = _spoken(monkeypatch)
    monkeypatch.setattr(awareness, "_check_battery", lambda: None)
    monkeypatch.setattr(awareness, "_main_drive", lambda: "C:\\")
    monkeypatch.setattr(psutil, "disk_usage", lambda path: _FakeUsage(total=100_000, free=40_000))  # 40% free
    assert awareness.check_health() == []
    assert spoken == []


# ---------- both together ----------

def test_both_conditions_alert_together(isolated_awareness, monkeypatch):
    spoken = _spoken(monkeypatch)
    monkeypatch.setattr(awareness, "_main_drive", lambda: "C:\\")
    monkeypatch.setattr(psutil, "sensors_battery", lambda: _FakeBattery(10))
    monkeypatch.setattr(psutil, "disk_usage", lambda path: _FakeUsage(total=100_000, free=2_000))
    alerts = awareness.check_health()
    assert persona.ALERT_BATTERY.format(percent=10) in alerts
    assert persona.ALERT_DISK.format(free=2) in alerts
    assert spoken == alerts


# ---------- service health (Ollama / microphone / internet) ----------

def test_ollama_down_alerts_once(isolated_awareness, monkeypatch):
    spoken = _spoken(monkeypatch)
    monkeypatch.setattr(awareness, "_ollama_reachable", lambda: False)
    monkeypatch.setattr(awareness, "_microphone_present", lambda: True)
    monkeypatch.setattr(awareness, "_internet_available", lambda: True)
    assert awareness.check_service_health() == [persona.ALERT_OLLAMA_DOWN]
    # still down -> silent (no nagging)
    spoken.clear()
    assert awareness.check_service_health() == []
    assert spoken == []


def test_mic_missing_alerts(isolated_awareness, monkeypatch):
    monkeypatch.setattr(awareness, "_ollama_reachable", lambda: True)
    monkeypatch.setattr(awareness, "_microphone_present", lambda: False)
    monkeypatch.setattr(awareness, "_internet_available", lambda: True)
    assert awareness.check_service_health() == [persona.ALERT_MIC_MISSING]


def test_no_internet_alerts(isolated_awareness, monkeypatch):
    monkeypatch.setattr(awareness, "_ollama_reachable", lambda: True)
    monkeypatch.setattr(awareness, "_microphone_present", lambda: True)
    monkeypatch.setattr(awareness, "_internet_available", lambda: False)
    assert awareness.check_service_health() == [persona.ALERT_NO_INTERNET]


def test_all_services_healthy_is_quiet(isolated_awareness, monkeypatch):
    monkeypatch.setattr(awareness, "_ollama_reachable", lambda: True)
    monkeypatch.setattr(awareness, "_microphone_present", lambda: True)
    monkeypatch.setattr(awareness, "_internet_available", lambda: True)
    assert awareness.check_service_health() == []


def test_service_check_realerts_after_recovery(isolated_awareness, monkeypatch):
    monkeypatch.setattr(awareness, "_microphone_present", lambda: True)
    monkeypatch.setattr(awareness, "_internet_available", lambda: True)
    monkeypatch.setattr(awareness, "_ollama_reachable", lambda: False)
    assert awareness.check_service_health() == [persona.ALERT_OLLAMA_DOWN]
    monkeypatch.setattr(awareness, "_ollama_reachable", lambda: True)
    assert awareness.check_service_health() == []  # recovers silently
    monkeypatch.setattr(awareness, "_ollama_reachable", lambda: False)
    assert awareness.check_service_health() == [persona.ALERT_OLLAMA_DOWN]  # re-alerts


# ---------- probes (never throw; return a clean bool) ----------

def test_ollama_reachable_true_when_tags_respond(monkeypatch):
    class _Resp:
        def raise_for_status(self):
            pass
    monkeypatch.setattr(awareness.requests, "get", lambda *a, **k: _Resp())
    assert awareness._ollama_reachable() is True


def test_ollama_reachable_false_when_request_fails(monkeypatch):
    def boom(*a, **k):
        raise requests.exceptions.ConnectionError
    monkeypatch.setattr(awareness.requests, "get", boom)
    assert awareness._ollama_reachable() is False


def test_microphone_present_detects_input(monkeypatch):
    monkeypatch.setattr(sounddevice, "query_devices",
                        lambda: [{"max_input_channels": 2}, {"max_input_channels": 0}])
    assert awareness._microphone_present() is True


def test_microphone_present_false_when_no_input(monkeypatch):
    monkeypatch.setattr(sounddevice, "query_devices", lambda: [{"max_input_channels": 0}])
    assert awareness._microphone_present() is False


def test_internet_available_connects(monkeypatch):
    class _Sock:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False
    monkeypatch.setattr(awareness.socket, "create_connection", lambda *a, **k: _Sock())
    assert awareness._internet_available() is True


def test_internet_unavailable_when_connect_fails(monkeypatch):
    def boom(*a, **k):
        raise OSError("offline")
    monkeypatch.setattr(awareness.socket, "create_connection", boom)
    assert awareness._internet_available() is False
