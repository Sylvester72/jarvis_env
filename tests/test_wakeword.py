"""Multiple wake words: the configurable list (config.all_wake_models), the
graceful resolver that skips model names with no available file, and the legacy
STT spoken-word list derived from the same config. openWakeWord's own package is
stubbed out so tests never construct real onnx models."""

import openwakeword
import pytest

from jarvis import config, voice, wakeword


@pytest.fixture
def clean_wake_config(monkeypatch):
    monkeypatch.setattr(config, "EXTRA_WAKE_WORDS", [])
    yield
    monkeypatch.setattr(config, "EXTRA_WAKE_WORDS", [])


@pytest.fixture
def fake_model_paths(tmp_path, monkeypatch):
    real = tmp_path / "hey_jarvis_v0.1.onnx"
    real.write_bytes(b"x")
    missing = tmp_path / "alexa_v0.1.onnx"  # in the registry, but no file on disk
    monkeypatch.setattr(openwakeword, "get_pretrained_model_paths", lambda fw: [
        str(real), str(missing)])
    return tmp_path


# ---------- the configured list ----------

def test_all_wake_models_primary_only(clean_wake_config):
    assert config.all_wake_models() == ["hey_jarvis"]


def test_all_wake_models_with_extras(clean_wake_config):
    config.EXTRA_WAKE_WORDS = ["alexa", "hey_mycroft"]
    assert config.all_wake_models() == ["hey_jarvis", "alexa", "hey_mycroft"]


def test_all_wake_models_dedupes_and_keeps_primary(clean_wake_config):
    config.EXTRA_WAKE_WORDS = ["alexa", "hey_jarvis", "alexa"]
    assert config.all_wake_models() == ["hey_jarvis", "alexa"]


def test_all_wake_models_guards_mangled_settings_string(clean_wake_config):
    config.EXTRA_WAKE_WORDS = "alexa"  # a string, not a list (bad settings file)
    assert config.all_wake_models() == ["hey_jarvis", "alexa"]


# ---------- graceful resolution (one bad entry can't break the rest) ----------

def test_resolvable_skips_names_with_no_file(isolated_memory, clean_wake_config, fake_model_paths):
    names = wakeword._resolvable_wake_models(["hey_jarvis", "alexa", "nope"])
    assert names == ["hey_jarvis"]


def test_resolvable_accepts_custom_model_path(isolated_memory, clean_wake_config, fake_model_paths):
    custom = fake_model_paths / "my_word.onnx"
    custom.write_bytes(b"x")
    names = wakeword._resolvable_wake_models(["hey_jarvis", str(custom)])
    assert names == ["hey_jarvis", str(custom)]


# ---------- opt-in via settings.json ----------

def test_extra_wake_words_persist_through_settings(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "_settings_path", lambda: str(tmp_path / "settings.json"))
    monkeypatch.setattr(config, "EXTRA_WAKE_WORDS", ["alexa"])
    config.save_settings()
    monkeypatch.setattr(config, "EXTRA_WAKE_WORDS", [])
    config.load_settings()
    assert config.EXTRA_WAKE_WORDS == ["alexa"]
    monkeypatch.setattr(config, "EXTRA_WAKE_WORDS", [])


# ---------- legacy STT words derive from the same list ----------

def test_legacy_wake_words_default(clean_wake_config):
    assert voice.legacy_wake_words() == ("jarvis",)


def test_legacy_wake_words_with_extra(clean_wake_config):
    config.EXTRA_WAKE_WORDS = ["hey_mycroft"]
    assert voice.legacy_wake_words() == ("jarvis", "mycroft")


def test_contains_wake_word_uses_configured_words(clean_wake_config):
    config.EXTRA_WAKE_WORDS = ["hey_mycroft"]
    assert voice.contains_wake_word("Hey Jarvis")
    assert voice.contains_wake_word("mycroft")
    assert not voice.contains_wake_word("computer")
