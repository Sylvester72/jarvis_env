"""Read-only file search: name-based matching, scope (Desktop/Documents/
Downloads only), result limits, and dispatcher routing (file search must win
over opening folders / Google search for the right phrasings). Uses throwaway
temp folders so the real profile folders are never touched."""

import webbrowser

import pytest

from jarvis import filesearch
from jarvis.commands import dispatcher, system


@pytest.fixture
def fake_roots(tmp_path, monkeypatch):
    roots = {}
    for name in ("Desktop", "Documents", "Downloads"):
        d = tmp_path / name
        d.mkdir(parents=True, exist_ok=True)
        roots[name] = d
    (roots["Desktop"] / "Tax Report 2026.pdf").write_text("x")
    (roots["Desktop"] / "notes.txt").write_text("x")
    (roots["Documents"] / "Resume_Final.docx").write_text("x")
    (roots["Documents"] / "Projects").mkdir()
    (roots["Documents"] / "Projects" / "Project_Notes.md").write_text("x")
    (roots["Downloads"] / "tax_photo.jpg").write_text("x")
    (tmp_path / "secret_outside.txt").write_text("x")  # OUTSIDE all three roots
    monkeypatch.setattr(filesearch, "_search_roots", lambda: tuple(
        (name, str(root)) for name, root in roots.items()))
    return roots


# ---------- matching and scope ----------

def test_find_matches_across_roots(fake_roots):
    reply = filesearch.search_files("tax")
    assert "Tax Report 2026.pdf in your Desktop folder" in reply
    assert "tax_photo.jpg in your Downloads folder" in reply


def test_find_by_substring_name(fake_roots):
    reply = filesearch.search_files("resume")
    assert "Resume_Final.docx in your Documents folder" in reply


def test_nested_file_reports_subfolder(fake_roots):
    reply = filesearch.search_files("project_notes")
    assert "Project_Notes.md in your Documents folder, under Projects" in reply


def test_nothing_found_is_plain(fake_roots):
    reply = filesearch.search_files("zzzznothing")
    assert "couldn't find anything called zzzznothing" in reply


def test_file_outside_roots_never_found(fake_roots):
    # secret_outside.txt lives in tmp_path, outside Desktop/Documents/Downloads,
    # so it must come back as a plain not-found rather than a match.
    reply = filesearch.search_files("secret_outside")
    assert "couldn't find anything called secret_outside" in reply


def test_empty_query_returns_none(fake_roots):
    assert filesearch.search_files("   ") is None


def test_more_than_five_reports_remainder(fake_roots):
    for i in range(7):
        (fake_roots["Desktop"] / f"bulk_{i}.txt").write_text("x")
    reply = filesearch.search_files("bulk_")
    assert "Found 7 matches" in reply
    assert "and 2 more" in reply


# ---------- dispatcher routing ----------

def test_dispatcher_routes_find_my(isolated_memory, fake_roots, monkeypatch):
    monkeypatch.setattr(filesearch, "search_files", lambda q: f"SEARCHED:{q}")
    reply = dispatcher.try_fixed_command("find my report")
    assert reply == "SEARCHED:report"


def test_find_my_documents_searches_not_opens(isolated_memory, fake_roots, monkeypatch):
    monkeypatch.setattr(filesearch, "search_files", lambda q: f"SEARCHED:{q}")
    monkeypatch.setattr(system, "open_folder", lambda name: (_ for _ in ()).throw(
        AssertionError("open_folder must not run for 'find my documents'")))
    reply = dispatcher.try_fixed_command("find my documents")
    assert reply == "SEARCHED:documents"


def test_find_my_photo_searches_not_webcam(isolated_memory, fake_roots, monkeypatch):
    monkeypatch.setattr(filesearch, "search_files", lambda q: f"SEARCHED:{q}")
    monkeypatch.setattr("jarvis.commands.camera.take_photo",
                        lambda: (_ for _ in ()).throw(AssertionError("camera must not run")))
    reply = dispatcher.try_fixed_command("find my photo")
    assert reply == "SEARCHED:photo"


def test_dispatcher_routes_file_called(isolated_memory, fake_roots, monkeypatch):
    monkeypatch.setattr(filesearch, "search_files", lambda q: f"SEARCHED:{q}")
    reply = dispatcher.try_fixed_command("search for a file called taxes")
    assert reply == "SEARCHED:taxes"


def test_dispatcher_routes_file_named(isolated_memory, fake_roots, monkeypatch):
    monkeypatch.setattr(filesearch, "search_files", lambda q: f"SEARCHED:{q}")
    reply = dispatcher.try_fixed_command("find the file named budget")
    assert reply == "SEARCHED:budget"


def test_plain_search_for_is_still_google(isolated_memory, fake_roots, monkeypatch):
    opened = []
    monkeypatch.setattr(webbrowser, "open", lambda url: opened.append(url))
    calls = []
    monkeypatch.setattr(filesearch, "search_files",
                        lambda q: calls.append(q) or "SHOULD_NOT_RUN")
    reply = dispatcher.try_fixed_command("search for quantum computing")
    assert reply == "Searching for quantum computing."
    assert opened == ["https://www.google.com/search?q=quantum computing"]
    assert calls == []  # file search must not have been triggered
