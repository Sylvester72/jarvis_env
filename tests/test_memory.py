"""Memory persistence: facts + conversation log survive a save/load round trip,
the log is capped, and bad/missing files fail open instead of crashing."""

import json
import os

from jarvis import memory


def test_round_trip(isolated_memory):
    memory.FACTS = ["I like tea", "The user is Alex"]
    memory.LOG = [["10:00:00", "You: hi"], ["10:00:01", "JARVIS: hello"]]
    memory.save_memory()
    memory.FACTS = []
    memory.LOG = []
    memory.load_memory()
    assert memory.FACTS == ["I like tea", "The user is Alex"]
    assert memory.LOG == [["10:00:00", "You: hi"], ["10:00:01", "JARVIS: hello"]]


def test_log_capped_at_max(isolated_memory, monkeypatch):
    monkeypatch.setattr(memory, "MAX_STORED_LOG_LINES", 5)
    memory.LOG = [[f"t{i}", f"line {i}"] for i in range(50)]
    memory.save_memory()
    with open(memory.MEMORY_PATH, encoding="utf-8") as f:
        data = json.load(f)
    assert len(data["log"]) == 5
    assert data["log"][-1] == ["t49", "line 49"]  # keeps the newest lines


def test_facts_are_saved_in_file(isolated_memory):
    memory.FACTS = ["Only this one"]
    memory.save_memory()
    with open(memory.MEMORY_PATH, encoding="utf-8") as f:
        data = json.load(f)
    assert data["facts"] == ["Only this one"]


def test_missing_file_loads_empty(isolated_memory):
    assert not os.path.exists(memory.MEMORY_PATH)
    memory.load_memory()  # must not raise
    assert memory.FACTS == []
    assert memory.LOG == []


def test_corrupt_file_loads_empty_without_crashing(isolated_memory):
    os.makedirs(os.path.dirname(memory.MEMORY_PATH), exist_ok=True)
    with open(memory.MEMORY_PATH, "w", encoding="utf-8") as f:
        f.write("{ this is not valid json !!!")
    memory.load_memory()  # must not raise
    assert memory.FACTS == []
    assert memory.LOG == []
