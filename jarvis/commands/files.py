"""FILE ACTIONS (scoped to your Desktop, for safety)
JARVIS can only create/rename/delete things inside your Desktop folder -
never anywhere else on the PC. This keeps a misheard filename from ever
touching something important."""

import os
import shutil

from jarvis import config
from jarvis.state import push_history


def create_file(name):
    path = os.path.join(config.DESKTOP_PATH, name)
    try:
        open(path, "a").close()
        return f"Created {name} on your Desktop."
    except Exception as e:
        push_history(f"(file create error: {e})")
        return f"I couldn't create {name}."


def create_folder(name):
    path = os.path.join(config.DESKTOP_PATH, name)
    try:
        os.makedirs(path, exist_ok=True)
        return f"Created the folder {name} on your Desktop."
    except Exception as e:
        push_history(f"(folder create error: {e})")
        return f"I couldn't create the folder {name}."


def rename_item(old_name, new_name):
    old_path = os.path.join(config.DESKTOP_PATH, old_name)
    new_path = os.path.join(config.DESKTOP_PATH, new_name)
    if not os.path.exists(old_path):
        return f"I can't find {old_name} on your Desktop."
    try:
        os.rename(old_path, new_path)
        return f"Renamed {old_name} to {new_name}."
    except Exception as e:
        push_history(f"(rename error: {e})")
        return f"I couldn't rename {old_name}."


def delete_item(name):
    path = os.path.join(config.DESKTOP_PATH, name)
    if not os.path.exists(path):
        return f"I can't find {name} on your Desktop."
    try:
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
        return f"Deleted {name}."
    except Exception as e:
        push_history(f"(delete error: {e})")
        return f"I couldn't delete {name}."
