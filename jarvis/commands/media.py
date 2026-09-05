"""Media keys (works with whatever app is currently playing)."""

import ctypes

VK_MEDIA_PLAY_PAUSE = 0xB3
VK_MEDIA_NEXT_TRACK = 0xB0
VK_MEDIA_PREV_TRACK = 0xB1
KEYEVENTF_KEYUP = 0x0002


def _media_key(vk):
    ctypes.windll.user32.keybd_event(vk, 0, 0, 0)
    ctypes.windll.user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)


def media_play_pause():
    _media_key(VK_MEDIA_PLAY_PAUSE)
    return "Toggling playback."


def media_next():
    _media_key(VK_MEDIA_NEXT_TRACK)
    return "Skipping to the next track."


def media_prev():
    _media_key(VK_MEDIA_PREV_TRACK)
    return "Going back a track."
