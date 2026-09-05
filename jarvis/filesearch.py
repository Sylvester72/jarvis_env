"""Read-only file search.

"find my <name>" / "search for a file called <name>" searches by FILENAME
(never file content) across three folders only - Desktop, Documents, and
Downloads. Nothing else on the PC is touched, and this module only reports
matches; it never opens, moves, or deletes anything.

Only a few matches are spoken (they're read aloud, so brevity matters), and a
clear "nothing found" reply is given when the name doesn't turn up. Scanning is
bounded: common heavy/irrelevant subfolders are skipped and the walk stops once
enough matches accumulate, so a huge Documents tree can't stall the voice.
"""

import os

MAX_RESULTS = 5    # spoken at most this many
MATCH_CAP = 12     # stop scanning after this many matches (bounds the walk)
_SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "site-packages"}


def _search_roots():
    """The three folders the search is allowed to look in."""
    home = os.path.expanduser("~")
    return (
        ("Desktop", os.path.join(home, "Desktop")),
        ("Documents", os.path.join(home, "Documents")),
        ("Downloads", os.path.join(home, "Downloads")),
    )


def search_files(query):
    """Find files whose name contains the query in Desktop/Documents/Downloads.
    Returns a spoken reply (nothing can be 'opened' - it's read-only)."""
    q = (query or "").strip().lower()
    if not q:
        return None

    exact, partial = [], []
    for label, root in _search_roots():
        if not os.path.isdir(root):
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
            for fn in filenames:
                lower = fn.lower()
                if lower == q or os.path.splitext(fn)[0].lower() == q:
                    exact.append((label, root, dirpath, fn))
                elif q in lower:
                    partial.append((label, root, dirpath, fn))
                if len(exact) + len(partial) >= MATCH_CAP:
                    return _format_results(q, exact, partial)
    return _format_results(q, exact, partial)


def _format_results(query, exact, partial):
    matched = sorted(exact + partial, key=lambda m: (m[0], m[3].lower()))
    if not matched:
        return (f"I couldn't find anything called {query} in your Desktop, "
                f"Documents, or Downloads folders.")
    shown = matched[:MAX_RESULTS]
    parts = ", ".join(_describe(*m) for m in shown)
    total = len(matched)
    if total == 1:
        return f"Found it: {parts}."
    more = f", and {total - MAX_RESULTS} more" if total > MAX_RESULTS else ""
    return f"Found {total} matches: {parts}{more}."


def _describe(label, root, dirpath, fn):
    if os.path.normcase(dirpath) == os.path.normcase(root):
        return f"{fn} in your {label} folder"
    rel = os.path.relpath(dirpath, root).replace(os.sep, ", ")
    return f"{fn} in your {label} folder, under {rel}"
