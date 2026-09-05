"""Remote / mobile access - a passcode-protected chat on the LOCAL NETWORK only.

A small Flask server exposes a phone-friendly chat page. Every request requires
authentication: a passcode is generated on first run, stored locally (in
data/remote_access.json, alongside the session-signing secret), and shown once
in the history panel so it can be typed on the phone.

Security is the point of this module, so it is deliberately conservative:
  * The server binds to the PC's LAN interface - never 0.0.0.0, and no
    port-forwarding or tunneling is set up anywhere. A phone on the same WiFi
    can reach it; the public internet cannot.
  * No unauthenticated request can do anything, including read-only ones - the
    login page is the only route that exists before authentication.
  * A remote command runs through the EXACT SAME handler and confirmation flow
    as a voice command (voice.handle_command). A destructive action requested
    remotely still arms the normal yes/no confirmation - no shortcuts, no
    bypasses. The spoken reply is captured and returned as the chat text
    instead of being played on the PC (it's a chat interface), but every other
    step is identical, so nothing destructive can be confirmed automatically.
  * Remote commands are logged to the history panel clearly labeled "[remote]".
  * Failed passcode attempts lock out for a minute after 5 tries.

The command text is plain text (like a voice transcript) and is never eval()'d
or exec()'d anywhere in this path - it goes through the same dispatcher/AI
pipeline as speech, which itself uses only a safe ast evaluator for math.
"""

import datetime
import json
import os
import secrets
import socket
import threading
import time

from flask import Flask, redirect, render_template_string, request, session
from werkzeug.serving import make_server

from jarvis import config
from jarvis import tts
from jarvis import voice
from jarvis.state import push_history

ACCESS_PATH = os.path.join(config.DATA_DIR, "remote_access.json")

_server = None
_thread = None
_access = {}            # {"passcode", "session_secret", "created"}
_command_lock = threading.Lock()
_transcripts = {}       # session_id -> [(role, text), ...]

# simple brute-force guard for the passcode
_LOCKOUT_AFTER = 5
_LOCKOUT_SECONDS = 60
_failures = 0
_last_failure = 0.0


# ---------- access config (passcode + session secret) ----------

def _load_or_create_access():
    """Load the stored passcode/secret, generating them on first run. Returns
    (access_dict, passcode, is_new)."""
    global _access
    data = {}
    if os.path.exists(ACCESS_PATH):
        try:
            with open(ACCESS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            push_history(f"(remote access config couldn't be read: {e})")
            data = {}
    is_new = False
    if not data.get("passcode") or not data.get("session_secret"):
        data = {
            "passcode": f"{secrets.randbelow(1000000):06d}",
            "session_secret": secrets.token_hex(32),
            "created": datetime.datetime.now().isoformat(timespec="seconds"),
        }
        _save_access(data)
        is_new = True
    _access = data
    return data, data["passcode"], is_new


def _save_access(data):
    try:
        with open(ACCESS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        push_history(f"(remote access config save error: {e})")


def _verify_passcode(code):
    stored = _access.get("passcode")
    if not stored:
        return False
    import hmac
    return hmac.compare_digest(code.strip(), stored)


def access_info():
    """(url, passcode) for the dashboard settings panel."""
    ip = _lan_ip()
    return f"http://{ip}:{config.REMOTE_PORT}", _access.get("passcode", "?")


def _lan_ip():
    """An address a phone on the same LAN can reach. Prefers a normal private
    IPv4 (10/8, 172.16/12, 192.168/16); otherwise the default-route interface's
    address (e.g. a CGNAT-assigned WiFi IP), then loopback as a last resort."""
    try:
        import psutil
        for iface, addrs in psutil.net_if_addrs().items():
            for a in addrs:
                if a.family == socket.AF_INET and _is_private_lan(a.address):
                    return a.address
    except Exception:
        pass
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # doesn't actually send packets
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def _is_private_lan(ip):
    parts = ip.split(".")
    if len(parts) != 4:
        return False
    a, b = int(parts[0]), int(parts[1])
    return a == 10 or (a == 172 and 16 <= b <= 31) or (a == 192 and b == 168)


# ---------- running a remote command through the voice handler ----------

def run_remote_command(command):
    """Run a command exactly as a voice command would (same handler, same
    confirmation flow), capturing the spoken reply to return to the caller.
    Serialized so remote commands never interleave, and logged to the history
    panel clearly labeled as remote."""
    command = (command or "").strip()
    with _command_lock:
        push_history(f"[remote] You: {command}")
        captured = []
        original_speak = tts.speak

        def _capture(text):
            captured.append(text)
            push_history(f"JARVIS: {text}")  # keep the reply visible in the panel

        tts.speak = _capture  # capture instead of playing audio on the PC
        try:
            keep_running = voice.handle_command(command)
        except Exception as e:
            push_history(f"(remote command error: {e})")
            captured.append("I hit an unexpected error on that one.")
            keep_running = True
        finally:
            tts.speak = original_speak
    reply = " ".join(captured) or "Done."
    return reply, keep_running


# ---------- the Flask app ----------

_LOGIN_PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JARVIS - Remote</title>
<style>
 body{margin:0;background:#000d12;color:#00e5ff;font-family:Consolas,monospace}
 .wrap{max-width:420px;margin:0 auto;padding:48px 20px}
 h1{font-size:20px;letter-spacing:3px;text-align:center;margin:0 0 24px}
 .box{background:#001820;border:1px solid #0a4f5c;padding:26px;border-radius:6px}
 label{display:block;font-size:11px;color:#5fa8b3;margin-bottom:8px;letter-spacing:1px}
 input{width:100%;box-sizing:border-box;background:#000d12;color:#00e5ff;border:1px solid #0a4f5c;
   padding:12px;font-size:20px;letter-spacing:8px;text-align:center;border-radius:4px;outline:none}
 button{width:100%;margin-top:16px;background:#00e5ff;color:#000d12;border:0;padding:12px;
   font-family:Consolas,monospace;font-size:14px;font-weight:bold;border-radius:4px;cursor:pointer}
 .err{color:#ff3b3b;font-size:12px;margin-top:12px;text-align:center}
</style></head><body><div class="wrap">
<h1>J A R V I S</h1>
<div class="box"><form method="post" action="/login">
<label>ACCESS PASSCODE</label>
<input name="code" inputmode="numeric" maxlength="6" autocomplete="off" autofocus>
<button type="submit">UNLOCK</button>
{% if error %}<div class="err">{{ error }}</div>{% endif %}
</form></div></div></body></html>"""

_CHAT_PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JARVIS - Remote</title>
<style>
 body{margin:0;background:#000d12;color:#00e5ff;font-family:Consolas,monospace;
   display:flex;flex-direction:column;height:100vh}
 header{padding:12px 16px;border-bottom:1px solid #0a4f5c;display:flex;justify-content:space-between;align-items:center}
 header h1{margin:0;font-size:14px;letter-spacing:3px}
 header form{display:inline}
 header button{background:none;border:1px solid #0a4f5c;color:#5fa8b3;
   font-family:Consolas,monospace;padding:4px 10px;cursor:pointer;font-size:10px}
 .log{flex:1;overflow-y:auto;padding:16px}
 .you{color:#ffffff;margin:0 0 10px;white-space:pre-wrap;word-wrap:break-word}
 .jarvis{color:#00e5ff;margin:0 0 16px;white-space:pre-wrap;word-wrap:break-word}
 .input{display:flex;border-top:1px solid #0a4f5c}
 .input input{flex:1;background:#000d12;color:#00e5ff;border:0;padding:14px;
   font-family:Consolas,monospace;font-size:15px;outline:none}
 .input button{background:#00e5ff;color:#000d12;border:0;padding:14px 20px;
   font-weight:bold;font-family:Consolas,monospace;cursor:pointer}
</style></head><body>
<header><h1>J A R V I S · REMOTE</h1>
<form method="post" action="/logout"><button type="submit">LOCK</button></form></header>
<div class="log">
{% for role, text in transcript %}
<div class="{{ role }}">{{ text }}</div>
{% endfor %}
</div>
<form class="input" method="post" action="/chat">
<input name="command" placeholder="Command JARVIS..." autocomplete="off" autofocus>
<button type="submit">SEND</button>
</form>
</body></html>"""


def _make_app():
    app = Flask(__name__)
    app.secret_key = _access["session_secret"]

    @app.route("/", methods=["GET"])
    def index():
        if session.get("session_id") and session["session_id"] in _transcripts:
            return render_template_string(_CHAT_PAGE,
                                          transcript=_transcripts[session["session_id"]])
        return render_template_string(_LOGIN_PAGE)

    @app.route("/login", methods=["POST"])
    def login():
        global _failures, _last_failure
        if _failures >= _LOCKOUT_AFTER and time.time() - _last_failure < _LOCKOUT_SECONDS:
            return render_template_string(_LOGIN_PAGE,
                                          error="Too many attempts. Try again in a minute.")
        if _verify_passcode(request.form.get("code", "")):
            _failures = 0
            sid = secrets.token_hex(8)
            session["session_id"] = sid
            _transcripts[sid] = []
            return redirect("/")
        _failures += 1
        _last_failure = time.time()
        return render_template_string(_LOGIN_PAGE, error="Incorrect passcode.")

    @app.route("/chat", methods=["POST"])
    def chat():
        sid = session.get("session_id")
        if not sid or sid not in _transcripts:
            return render_template_string(_LOGIN_PAGE)  # not authenticated
        command = (request.form.get("command") or "").strip()
        history = _transcripts[sid]
        if command:
            history.append(("you", command))
            reply, _keep_running = run_remote_command(command)
            history.append(("jarvis", reply))
            _transcripts[sid] = history[-30:]
        return render_template_string(_CHAT_PAGE, transcript=_transcripts[sid])

    @app.route("/logout", methods=["POST"])
    def logout():
        sid = session.pop("session_id", None)
        if sid:
            _transcripts.pop(sid, None)
        return redirect("/")

    return app


# ---------- lifecycle ----------

def start_server():
    """Bind the Flask app to the LAN interface and serve it in a background
    thread. Idempotent. Never binds to 0.0.0.0 and never opens the internet."""
    global _server, _thread
    if not config.REMOTE_ENABLED:
        return
    if _server is not None:
        return
    _load_or_create_access()
    app = _make_app()
    ip = _lan_ip()
    port = config.REMOTE_PORT
    try:
        _server = make_server(ip, port, app, threaded=True)
    except Exception as e:
        push_history(f"[remote] Couldn't start remote access on {ip}:{port} - {e}")
        _server = None
        return
    _thread = threading.Thread(target=_server.serve_forever, daemon=True)
    _thread.start()
    passcode = _access.get("passcode", "?")
    push_history(f"[remote] Remote access enabled on this network - {ip}:{port}")
    push_history(f"[remote] Phone URL: http://{ip}:{port}   Passcode: {passcode}")


def stop_server():
    """Stop the LAN server. Idempotent."""
    global _server, _thread
    if _server is not None:
        try:
            _server.shutdown()
        except Exception:
            pass
        _server = None
    _thread = None
