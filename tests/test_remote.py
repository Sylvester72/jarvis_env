"""Remote / mobile access: access-config generation, passcode auth on every
request, the shared command handler with confirmation flow (no shortcuts for
destructive actions), and remote history labeling. The Flask app is exercised
through its test client; the LAN server itself is not started in tests."""

import json

import pytest

from jarvis import config, remote
from jarvis.commands import dispatcher


@pytest.fixture
def isolated_remote(tmp_path, monkeypatch):
    """Reset remote state only - each test generates/uses its own access config.
    The fixture does NOT create the passcode so first-run generation is testable."""
    monkeypatch.setattr(remote, "ACCESS_PATH", str(tmp_path / "remote_access.json"))
    monkeypatch.setattr(remote, "_access", {})
    monkeypatch.setattr(remote, "_failures", 0)
    monkeypatch.setattr(remote, "_last_failure", 0.0)
    yield
    monkeypatch.setattr(remote, "_access", {})


def _client():
    """A test client with access config ready (generated on demand)."""
    if not remote._access.get("passcode"):
        remote._load_or_create_access()
    return remote._make_app().test_client()


# ---------- access config ----------

def test_access_generated_once_and_persisted(isolated_remote):
    _data, passcode, is_new = remote._load_or_create_access()
    assert is_new is True
    assert passcode.isdigit() and len(passcode) == 6
    # second call reuses the same passcode (it's stored, shown once)
    _data2, passcode2, is_new2 = remote._load_or_create_access()
    assert passcode2 == passcode
    assert is_new2 is False
    with open(remote.ACCESS_PATH, encoding="utf-8") as f:
        saved = json.load(f)
    assert saved["passcode"] == passcode


def test_verify_passcode(isolated_remote):
    remote._load_or_create_access()
    assert remote._verify_passcode(remote._access["passcode"]) is True
    assert remote._verify_passcode("000000") is False
    assert remote._verify_passcode("") is False


# ---------- authentication is required for every request ----------

def test_chat_without_auth_returns_login(isolated_remote):
    client = _client()
    resp = client.post("/chat", data={"command": "what's 2 plus 2"})
    assert resp.status_code == 200
    assert b"ACCESS PASSCODE" in resp.data  # the login page, command never ran


def test_root_without_auth_returns_login(isolated_remote):
    assert b"ACCESS PASSCODE" in _client().get("/").data


def test_login_wrong_then_right(isolated_remote):
    client = _client()
    r = client.post("/login", data={"code": "000000"})
    assert b"Incorrect passcode" in r.data
    r = client.post("/login", data={"code": remote._access["passcode"]})
    assert r.status_code == 302
    assert "J A R V I S · REMOTE" in client.get("/").data.decode()


def test_login_lockout_after_failures(isolated_remote):
    client = _client()
    for _ in range(5):
        client.post("/login", data={"code": "000000"})
    r = client.post("/login", data={"code": remote._access["passcode"]})
    assert b"Too many attempts" in r.data  # even the right code is refused


def test_logout_ends_session(isolated_remote):
    client = _client()
    client.post("/login", data={"code": remote._access["passcode"]})
    client.post("/logout")
    assert b"ACCESS PASSCODE" in client.post("/chat", data={"command": "hi"}).data


# ---------- remote commands go through the shared handler ----------

def test_run_remote_command_returns_reply(isolated_memory, isolated_remote):
    reply, keep = remote.run_remote_command("what's 2 plus 2")
    assert reply == "That's 4."
    assert keep is True


def test_run_remote_command_labels_history(isolated_memory, isolated_remote, monkeypatch):
    pushed = []
    monkeypatch.setattr(remote, "push_history", lambda text: pushed.append(text))
    remote.run_remote_command("what's the time")
    assert any(t.startswith("[remote] You:") for t in pushed)
    assert any(t.startswith("JARVIS:") for t in pushed)


def test_chat_runs_command_after_login(isolated_memory, isolated_remote):
    client = _client()
    client.post("/login", data={"code": remote._access["passcode"]})
    resp = client.post("/chat", data={"command": "what's 2 plus 2"})
    assert resp.status_code == 200
    # the reply is rendered (and HTML-escaped, so the apostrophe is &#39;)
    assert "That&#39;s 4." in resp.data.decode()


# ---------- destructive actions still confirm remotely ----------

def test_destructive_action_requires_confirmation_remotely(isolated_memory, isolated_remote,
                                                          tmp_path, monkeypatch):
    desktop = tmp_path / "Desktop"
    desktop.mkdir()
    target = desktop / "victim.txt"
    target.write_text("precious data")
    monkeypatch.setattr(config, "DESKTOP_PATH", str(desktop))

    reply1, _ = remote.run_remote_command("delete victim.txt")
    assert "can't be undone" in reply1                    # the confirmation prompt
    assert dispatcher.PENDING_CONFIRM["action"] == "delete"
    assert target.exists()                                # NOT deleted without a yes

    reply2, _ = remote.run_remote_command("yes")
    assert "Deleted victim.txt" in reply2
    assert not target.exists()


def test_lan_ip_never_wildcard():
    ip = remote._lan_ip()
    assert ip and ip != "0.0.0.0"