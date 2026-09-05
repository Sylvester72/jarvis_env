"""The dashboard GUI - an Iron Man style HUD. All Tkinter calls stay on the
main thread; the voice thread talks to it through the shared gui_queue."""

import datetime
import math
import queue
import tkinter as tk
from tkinter import scrolledtext
from tkinter import ttk

from jarvis import config
from jarvis import memory
from jarvis import remote
from jarvis.commands import dispatcher
from jarvis.state import gui_queue, push_status, stop_flag

BG = "#000d12"
PANEL_BG = "#001820"
CYAN = "#00e5ff"
CYAN_DIM = "#0a4f5c"
AMBER = "#ffb000"
GREEN = "#00ff9c"
RED = "#ff3b3b"
TEXT_DIM = "#5fa8b3"

STATE_COLORS = {
    "sleeping": CYAN_DIM,
    "listening": CYAN,
    "thinking": AMBER,
    "speaking": GREEN,
}

# Ollama models offered in the settings panel. The currently-installed one
# (llama3.2) is first; the rest are reasonable upgrades to pull with:
#     ollama pull <model>
MODEL_SUGGESTIONS = ["llama3.2", "qwen2.5:7b", "llama3.1:8b", "gemma2:9b"]


# ---- color maths: used to ease the status core between states smoothly ----
# (a cinematic fade rather than an instant snap, so mode changes read as the
# arc reactor powering up or down)

def _hex_to_rgb(hex_color):
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _rgb_to_hex(c):
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(round(v)))) for v in c)


def _mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


STATE_RGB = {mode: _hex_to_rgb(color) for mode, color in STATE_COLORS.items()}


def classify_status(text):
    t = text.lower()
    if "listening" in t or "your command" in t:
        return "listening"
    if "thinking" in t:
        return "thinking"
    if "speaking" in t:
        return "speaking"
    return "sleeping"


class HUDCore(tk.Canvas):
    """Animated circular status core, like an arc reactor."""

    def __init__(self, parent, size=170, **kwargs):
        super().__init__(parent, width=size, height=size, bg=BG, highlightthickness=0, **kwargs)
        self.size = size
        self.angle = 0
        self.mode = "sleeping"
        self.tick = 0
        self.color = STATE_RGB["sleeping"]  # current eased rgb; approaches the state color
        self._animate()

    def set_mode(self, mode):
        self.mode = mode

    def _animate(self):
        self.delete("all")
        s = self.size
        cx = cy = s / 2
        self.tick += 1

        # Ease the core color toward the mode color. On a state change this
        # reads as the reactor powering up or down rather than snapping.
        target = STATE_RGB.get(self.mode, STATE_RGB["sleeping"])
        self.color = _mix(self.color, target, 0.22)
        color = _rgb_to_hex(self.color)
        glow = _rgb_to_hex(_mix(self.color, _hex_to_rgb(PANEL_BG), 0.55))

        speed = {"sleeping": 1, "listening": 4, "thinking": 6, "speaking": 5}.get(self.mode, 1)
        self.angle = (self.angle + speed) % 360

        # Smooth breathing pulse - sine in/out instead of a linear sawtooth,
        # so the expansion feels organic rather than mechanical.
        phase = 2 * math.pi * (self.tick % 60) / 60
        pulse_r = 3.5 * (0.5 - 0.5 * math.cos(phase))

        # Ambient outer glow - brightens as the core wakes up
        self.create_oval(2, 2, s - 2, s - 2, outline=glow, width=3)

        # Outer static ring
        self.create_oval(6, 6, s - 6, s - 6, outline=CYAN_DIM, width=2)

        # Rotating segmented arc ring
        for i in range(8):
            start = self.angle + i * 45
            extent = 20
            self.create_arc(
                16, 16, s - 16, s - 16, start=start, extent=extent,
                style="arc", outline=color, width=3,
            )

        # Inner glowing core
        inner_r = 28 + pulse_r
        self.create_oval(
            cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r,
            outline=color, width=2, fill=PANEL_BG,
        )
        self.create_oval(
            cx - inner_r + 10, cy - inner_r + 10, cx + inner_r - 10, cy + inner_r - 10,
            fill=color, outline="",
        )

        self.after(40, self._animate)


class BracketFrame(tk.Frame):
    """A frame with HUD-style corner brackets drawn around it. Corner ticks on
    all four corners + a faint running rule keep it reading as deliberate
    instrumentation rather than a plain box."""

    def __init__(self, parent, title, **kwargs):
        super().__init__(parent, bg=BG, **kwargs)
        top = tk.Canvas(self, bg=BG, highlightthickness=0, height=14)
        top.pack(fill="x")
        self.bind("<Configure>", lambda e: self._draw_top(top, e))

        tk.Label(
            self, text=f"// {title}", font=("Consolas", 11, "bold"),
            fg=CYAN, bg=BG, anchor="w",
        ).pack(fill="x", padx=4, pady=(0, 2))

        self.body = tk.Frame(self, bg=PANEL_BG, highlightbackground=CYAN_DIM, highlightthickness=1)
        self.body.pack(fill="both", expand=True, padx=2, pady=(2, 0))

        bottom = tk.Canvas(self, bg=BG, highlightthickness=0, height=8)
        bottom.pack(fill="x")
        self.bind("<Configure>", lambda e: self._draw_bottom(bottom, e))

    def _draw_top(self, canvas, event):
        canvas.delete("all")
        w = event.width
        L = 16
        # corner ticks
        canvas.create_line(0, 2, L, 2, fill=CYAN, width=2)
        canvas.create_line(0, 2, 0, 10, fill=CYAN, width=2)
        canvas.create_line(w, 2, w - L, 2, fill=CYAN, width=2)
        canvas.create_line(w, 2, w, 10, fill=CYAN, width=2)
        # faint running rule between the ticks
        canvas.create_line(L + 1, 2, w - L - 1, 2, fill=CYAN_DIM, width=1)

    def _draw_bottom(self, canvas, event):
        canvas.delete("all")
        w = event.width
        L = 16
        canvas.create_line(0, 6, L, 6, fill=CYAN, width=2)
        canvas.create_line(0, 6, 0, 1, fill=CYAN, width=2)
        canvas.create_line(w, 6, w - L, 6, fill=CYAN, width=2)
        canvas.create_line(w, 6, w, 1, fill=CYAN, width=2)


class SettingsPanel(tk.Toplevel):
    """Dashboard settings: voice-match threshold, silence timing, and the TTS
    voice. Changes apply live to the running assistant; 'Save' persists them
    to data/settings.json so they survive the next launch."""

    def __init__(self, master):
        super().__init__(master)
        self.title("JARVIS - SYSTEM SETTINGS")
        self.configure(bg=BG)
        self.resizable(False, False)

        body = tk.Frame(self, bg=BG)
        body.pack(fill="both", expand=True, padx=16, pady=(12, 6))

        def row_label(text, row):
            tk.Label(body, text=text, font=("Consolas", 9, "bold"),
                     fg=CYAN, bg=BG, anchor="w").grid(row=row, column=0, sticky="w", padx=(0, 12), pady=(10, 0))

        def value_label(row):
            var = tk.StringVar()
            lbl = tk.Label(body, textvariable=var, font=("Consolas", 9),
                           fg=TEXT_DIM, bg=BG, width=10, anchor="e")
            lbl.grid(row=row, column=1, sticky="e", pady=(10, 0))
            return var

        # ---- Voice match threshold ----
        row_label("VOICE MATCH THRESHOLD", 0)
        self.vt_var = value_label(0)
        self.vt_scale = tk.Scale(body, from_=0.40, to=0.90, resolution=0.01, orient="horizontal",
                                 bg=BG, fg=CYAN, troughcolor=PANEL_BG, highlightthickness=0,
                                 length=230, command=self._on_vt)
        self.vt_scale.grid(row=1, column=0, columnspan=2, sticky="w")
        self.vt_scale.set(config.VOICE_MATCH_THRESHOLD)

        # ---- Silence hang ----
        row_label("SILENCE HANG (ms)", 2)
        self.sh_var = value_label(2)
        self.sh_scale = tk.Scale(body, from_=300, to=2000, resolution=50, orient="horizontal",
                                 bg=BG, fg=CYAN, troughcolor=PANEL_BG, highlightthickness=0,
                                 length=230, command=self._on_sh)
        self.sh_scale.grid(row=3, column=0, columnspan=2, sticky="w")
        self.sh_scale.set(config.SILENCE_HANG_MS)

        # ---- Silence energy (auto-calibrate or manual) ----
        self.auto_var = tk.BooleanVar(value=config.SILENCE_ENERGY_AUTO_CALIBRATE)
        tk.Checkbutton(body, text="AUTO-CALIBRATE SILENCE ENERGY AT STARTUP",
                       variable=self.auto_var, command=self._on_auto, bg=BG, fg=CYAN,
                       selectcolor=PANEL_BG, activebackground=BG, activeforeground=CYAN,
                       font=("Consolas", 9), anchor="w", highlightthickness=0,
                       ).grid(row=4, column=0, columnspan=2, sticky="w", pady=(12, 0))
        row_label("SILENCE ENERGY (manual)", 5)
        self.se_var = value_label(5)
        self.se_scale = tk.Scale(body, from_=30, to=600, resolution=5, orient="horizontal",
                                 bg=BG, fg=CYAN, troughcolor=PANEL_BG, highlightthickness=0,
                                 length=230, command=self._on_se)
        self.se_scale.grid(row=6, column=0, columnspan=2, sticky="w")
        self.se_scale.set(config.SILENCE_ENERGY_THRESHOLD)
        self._update_se_state()

        # ---- TTS voice ----
        row_label("EDGE TTS VOICE", 7)
        self.edge_var = tk.StringVar(value=config.EDGE_VOICE)
        tk.Entry(body, textvariable=self.edge_var, width=26, bg=PANEL_BG, fg=CYAN,
                 insertbackground=CYAN, relief="flat", font=("Consolas", 9),
                 highlightbackground=CYAN_DIM, highlightthickness=1,
                 ).grid(row=7, column=1, sticky="e", pady=(10, 0))

        row_label("OFFLINE VOICE INDEX", 8)
        self.index_var = tk.StringVar(value=str(config.TTS_VOICE_INDEX))
        tk.Spinbox(body, from_=0, to=12, textvariable=self.index_var, width=5,
                   bg=PANEL_BG, fg=CYAN, buttonbackground="#0a2430", relief="flat",
                   font=("Consolas", 9), highlightbackground=CYAN_DIM, highlightthickness=1,
                   ).grid(row=8, column=1, sticky="e", pady=(10, 0))

        # ---- TTS rate ----
        row_label("TTS RATE", 9)
        self.tr_var = value_label(9)
        self.tr_scale = tk.Scale(body, from_=100, to=250, resolution=5, orient="horizontal",
                                 bg=BG, fg=CYAN, troughcolor=PANEL_BG, highlightthickness=0,
                                 length=230, command=self._on_tr)
        self.tr_scale.grid(row=10, column=0, columnspan=2, sticky="w")
        self.tr_scale.set(config.TTS_RATE)

        # ---- Ollama model (conversation engine; 'ollama pull <model>' first) ----
        row_label("OLLAMA MODEL", 11)
        self.model_combo = ttk.Combobox(
            body, values=MODEL_SUGGESTIONS, width=22,
            font=("Consolas", 9),
        )
        self.model_combo.set(config.MODEL)
        self.model_combo.grid(row=12, column=0, columnspan=2, sticky="ew", padx=(0, 12), pady=(4, 0))
        self.model_combo.bind("<<ComboboxSelected>>", self._on_model)
        tk.Label(body, text="apply next reply ·  ollama pull <model>",
                 font=("Consolas", 8), fg=TEXT_DIM, bg=BG, anchor="w",
                 ).grid(row=13, column=0, columnspan=2, sticky="w", padx=(0, 12), pady=(2, 0))

        # ---- Extra wake words (comma-separated openWakeWord model names) ----
        row_label("EXTRA WAKE WORDS", 14)
        self.ww_var = tk.StringVar(value=", ".join(config.EXTRA_WAKE_WORDS))
        tk.Entry(body, textvariable=self.ww_var, width=26, bg=PANEL_BG, fg=CYAN,
                 insertbackground=CYAN, relief="flat", font=("Consolas", 9),
                 highlightbackground=CYAN_DIM, highlightthickness=1,
                 ).grid(row=14, column=1, sticky="e", pady=(10, 0))
        tk.Label(body, text="comma-separated openWakeWord names · takes effect on restart",
                 font=("Consolas", 8), fg=TEXT_DIM, bg=BG, anchor="w",
                 ).grid(row=15, column=0, columnspan=2, sticky="w", padx=(0, 12), pady=(2, 0))

        # ---- Remote access (LAN only, passcode-protected) ----
        self.remote_var = tk.BooleanVar(value=config.REMOTE_ENABLED)
        tk.Checkbutton(body, text="ENABLE REMOTE ACCESS (LOCAL NETWORK ONLY)",
                       variable=self.remote_var, bg=BG, fg=CYAN,
                       selectcolor=PANEL_BG, activebackground=BG, activeforeground=CYAN,
                       font=("Consolas", 9), anchor="w", highlightthickness=0,
                       ).grid(row=16, column=0, columnspan=2, sticky="w", pady=(12, 0))
        tk.Label(body, text="URL and passcode are shown in the log on startup",
                 font=("Consolas", 8), fg=TEXT_DIM, bg=BG, anchor="w",
                 ).grid(row=17, column=0, columnspan=2, sticky="w", padx=(0, 12), pady=(2, 0))

        tk.Button(self, text="SAVE & APPLY", command=self._save,
                  bg="#0a2430", fg=CYAN, activebackground=CYAN_DIM, activeforeground=CYAN,
                  font=("Consolas", 10, "bold"), borderwidth=0, pady=8,
                  highlightbackground=CYAN_DIM, highlightthickness=1,
                  ).pack(fill="x", padx=16, pady=(6, 12))

    # ---- live-update callbacks (mutate config immediately) ----
    def _on_vt(self, value):
        config.VOICE_MATCH_THRESHOLD = float(value)
        self.vt_var.set(f"{float(value):.2f}")

    def _on_sh(self, value):
        config.SILENCE_HANG_MS = int(value)
        self.sh_var.set(f"{int(value)} ms")

    def _on_se(self, value):
        config.SILENCE_ENERGY_THRESHOLD = int(value)
        self.se_var.set(f"{int(value)}")

    def _on_tr(self, value):
        config.TTS_RATE = int(value)
        self.tr_var.set(f"{int(value)}")

    def _on_auto(self):
        config.SILENCE_ENERGY_AUTO_CALIBRATE = self.auto_var.get()
        self._update_se_state()

    def _on_model(self, _event=None):
        model = self.model_combo.get().strip()
        if model:
            config.MODEL = model  # applies from the next reply onward

    def _update_se_state(self):
        self.se_scale.configure(state="disabled" if self.auto_var.get() else "normal")

    def _save(self):
        try:
            config.TTS_VOICE_INDEX = int(self.index_var.get())
        except ValueError:
            pass  # leave the current value if the field is mangled
        config.EDGE_VOICE = self.edge_var.get().strip() or config.EDGE_VOICE
        config.EXTRA_WAKE_WORDS = [
            w.strip() for w in self.ww_var.get().split(",") if w.strip()
        ]
        config.REMOTE_ENABLED = self.remote_var.get()
        self._on_model()  # persist whatever model is in the field
        config.save_settings()
        # Apply the remote toggle live (start_server/stop_server are idempotent)
        if config.REMOTE_ENABLED:
            remote.start_server()
        else:
            remote.stop_server()
        self.destroy()


class JarvisDashboard:
    def __init__(self, root):
        self.root = root
        root.title("J.A.R.V.I.S.")
        root.geometry("880x580")
        root.configure(bg=BG)

        # ---- Header ----
        header = tk.Frame(root, bg=BG)
        header.pack(fill="x", pady=(14, 0))
        tk.Button(
            header, text="SETTINGS", command=self.open_settings,
            bg="#0a2430", fg=CYAN, activebackground=CYAN_DIM, activeforeground=CYAN,
            font=("Consolas", 9, "bold"), borderwidth=0, padx=10, pady=4,
            highlightbackground=CYAN_DIM, highlightthickness=1,
        ).pack(side="right", padx=14)
        tk.Label(
            header, text="J . A . R . V . I . S .", font=("Consolas", 22, "bold"),
            fg=CYAN, bg=BG,
        ).pack()
        tk.Label(
            header, text="PERSONAL ASSISTANT INTERFACE", font=("Consolas", 9),
            fg=TEXT_DIM, bg=BG,
        ).pack()
        tk.Frame(root, bg=CYAN_DIM, height=1).pack(fill="x", padx=24, pady=(6, 0))

        # ---- Core status ring + text ----
        core_frame = tk.Frame(root, bg=BG)
        core_frame.pack(pady=(12, 8))
        self.core = HUDCore(core_frame)
        self.core.pack()

        self.status_var = tk.StringVar(value="INITIALIZING...")
        self.status_label = tk.Label(
            root, textvariable=self.status_var, font=("Consolas", 13, "bold"),
            fg=CYAN, bg=BG,
        )
        self.status_label.pack()

        # ---- Volume gauge ----
        vol_frame = tk.Frame(root, bg=BG)
        vol_frame.pack(pady=(8, 4))
        tk.Label(vol_frame, text="VOL", font=("Consolas", 9), fg=TEXT_DIM, bg=BG).pack(side="left", padx=(0, 6))
        self.vol_canvas = tk.Canvas(vol_frame, width=220, height=14, bg=BG, highlightthickness=0)
        self.vol_canvas.pack(side="left")
        self.vol_label = tk.Label(vol_frame, text="--", font=("Consolas", 9), fg=TEXT_DIM, bg=BG)
        self.vol_label.pack(side="left", padx=(6, 0))

        # ---- Main panels ----
        main_frame = tk.Frame(root, bg=BG)
        main_frame.pack(fill="both", expand=True, padx=16, pady=(10, 6))

        left_panel = BracketFrame(main_frame, "COMMAND REGISTRY", width=260)
        left_panel.pack(side="left", fill="y", padx=(0, 12))
        left_panel.pack_propagate(False)
        cmd_box = tk.Listbox(
            left_panel.body, bg=PANEL_BG, fg=CYAN, selectbackground=CYAN_DIM,
            borderwidth=0, highlightthickness=0, font=("Consolas", 10),
            activestyle="none",
        )
        for cmd in dispatcher.COMMAND_LIST:
            cmd_box.insert("end", f"> {cmd}")
        cmd_box.pack(fill="both", expand=True, padx=6, pady=6)

        right_panel = BracketFrame(main_frame, "SYSTEM LOG")
        right_panel.pack(side="left", fill="both", expand=True)
        self.history_box = scrolledtext.ScrolledText(
            right_panel.body, bg=PANEL_BG, fg=CYAN, wrap="word",
            borderwidth=0, highlightthickness=0, font=("Consolas", 10),
            insertbackground=CYAN,
        )
        self.history_box.pack(fill="both", expand=True, padx=6, pady=6)
        self.history_box.configure(state="disabled")
        self.history_box.tag_configure("dim", foreground=TEXT_DIM)
        self.history_box.tag_configure("user", foreground="#ffffff")
        self.history_box.tag_configure("jarvis", foreground=CYAN)
        self.history_box.tag_configure("remote", foreground=AMBER)  # commands from the phone

        # Load conversation log saved from previous sessions, if any
        if memory.LOG:
            self._insert_line("-- previous session --", "dim")
            for timestamp, text in memory.LOG:
                self._insert_line(text, self._tag_for(text), timestamp)
            self._insert_line("-- current session --", "dim")

        # ---- Footer ----
        tk.Button(
            root, text="◉  DISCONNECT", command=self.quit, bg="#2a0a0a", fg=RED,
            activebackground="#3a0f0f", activeforeground=RED,
            font=("Consolas", 10, "bold"), borderwidth=0, pady=8,
            highlightbackground=RED, highlightthickness=1,
        ).pack(fill="x", padx=16, pady=(0, 14))

        root.protocol("WM_DELETE_WINDOW", self.quit)
        self.poll_queue()

    def open_settings(self):
        SettingsPanel(self.root)

    def _tag_for(self, text):
        if text.startswith("[remote]"):
            return "remote"
        if text.startswith("JARVIS:"):
            return "jarvis"
        if text.startswith("You:"):
            return "user"
        return "dim"

    def _insert_line(self, text, tag, timestamp=None):
        timestamp = timestamp or datetime.datetime.now().strftime("%H:%M:%S")
        self.history_box.configure(state="normal")
        self.history_box.insert("end", f"[{timestamp}] ", "dim")
        self.history_box.insert("end", f"{text}\n", tag)
        self.history_box.see("end")
        self.history_box.configure(state="disabled")

    def _draw_volume(self, percent):
        self.vol_canvas.delete("all")
        w = 220
        # dim full-width track behind the segments
        self.vol_canvas.create_rectangle(1, 6, w - 1, 9, fill="#04222b", outline="")
        segments = 20
        filled = 0 if percent is None else round((percent / 100) * segments)
        for i in range(segments):
            x0 = 2 + i * 11
            if i < filled:
                color = CYAN
            elif percent is not None and i == filled:
                color = CYAN_DIM  # the "live" lead edge of the current level
            else:
                color = "#06303a"
            # rounded segment - create_polygon with smooth=True gives the
            # capsule shape (create_rectangle has no smooth option)
            self.vol_canvas.create_polygon(
                x0, 3, x0 + 8, 3, x0 + 8, 9, x0, 9,
                smooth=True, fill=color, outline="",
            )
        self.vol_label.config(text="--" if percent is None else f"{percent}%")

    def poll_queue(self):
        try:
            while True:
                kind, value = gui_queue.get_nowait()
                if kind == "status":
                    self.status_var.set(value.upper())
                    mode = classify_status(value)
                    self.core.set_mode(mode)
                    self.status_label.configure(fg=STATE_COLORS[mode])
                elif kind == "volume":
                    self._draw_volume(value)
                elif kind == "history":
                    timestamp, text = value
                    self._insert_line(text, self._tag_for(text), timestamp)
        except queue.Empty:
            pass
        if not stop_flag.is_set():
            self.root.after(150, self.poll_queue)

    def quit(self):
        stop_flag.set()
        push_status("Shutting down...")
        self.root.after(500, self.root.destroy)
