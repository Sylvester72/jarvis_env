"""Shared fixtures. Run tests with:  jarvis_env/Scripts/python.exe -m pytest
(from the project root, so the jarvis package is importable)."""

import pytest

from jarvis import memory
from jarvis.commands import dispatcher


@pytest.fixture
def isolated_memory(tmp_path, monkeypatch):
    """Point the memory module at a throwaway file and start with clean state,
    so tests never touch the real data/ folder or carry facts between tests."""
    monkeypatch.setattr(memory, "MEMORY_PATH", str(tmp_path / "memory.json"))
    monkeypatch.setattr(memory, "FACTS", [])
    monkeypatch.setattr(memory, "LOG", [])
    dispatcher.PENDING_CONFIRM = {"action": None, "arg": None}
    yield
    dispatcher.PENDING_CONFIRM = {"action": None, "arg": None}
