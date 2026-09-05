"""Real weather via Open-Meteo (free, no API key).

"what's the weather" / "what's the weather in <city>" geocodes the city with
Open-Meteo's geocoding API and fetches current conditions plus today's high/low
from its forecast API, then returns a short natural spoken summary.

If no city is named and no default is stored yet, JARVIS asks once for a
default city/coordinates and persists it to data/weather_location.json - it
does not guess a location or use IP geolocation.
"""

import json
import os
import re

from jarvis import config
from jarvis import net
from jarvis import persona
from jarvis.state import push_history

LOCATION_PATH = os.path.join(config.DATA_DIR, "weather_location.json")

DEFAULT_LOCATION = None  # {"name": str, "lat": float, "lon": float}

_awaiting_city = False

_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

_SKIP_WORDS = ("never mind", "skip", "cancel", "forget it", "don't bother", "none")


# ---------- persisted default location ----------

def load_default_location():
    global DEFAULT_LOCATION
    DEFAULT_LOCATION = None
    if not os.path.exists(LOCATION_PATH):
        return
    try:
        with open(LOCATION_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and data.get("name") and data.get("lat") is not None:
            DEFAULT_LOCATION = data
    except Exception as e:
        push_history(f"(weather location couldn't be loaded: {e})")
        DEFAULT_LOCATION = None


def _save_default_location(location):
    global DEFAULT_LOCATION
    DEFAULT_LOCATION = location
    try:
        with open(LOCATION_PATH, "w", encoding="utf-8") as f:
            json.dump(location, f, indent=2)
    except Exception as e:
        push_history(f"(weather location save error: {e})")


# ---------- the one-time "which city?" prompt ----------

def is_awaiting_city():
    return _awaiting_city


def consume_city_answer(command):
    """Called on the utterance right after the 'which city?' prompt. Treats it
    as the default city, remembers it, and returns the current weather summary.
    Returns None if no city was being awaited."""
    global _awaiting_city
    if not _awaiting_city:
        return None
    _awaiting_city = False
    c = command.lower().strip()
    if any(w in c for w in _SKIP_WORDS):
        return persona.WEATHER_CITY_SKIPPED
    location = geocode_city(command.strip())
    if location is None:
        return persona.WEATHER_NOT_FOUND.format(city=command.strip())
    _save_default_location(location)
    return _weather_summary(location)


# ---------- command handling ----------

def handle_weather_command(command):
    """Route a weather request. Returns a line to speak, or None if the
    command isn't a weather request. May set the pending 'which city?' prompt."""
    c = command.lower()
    if "weather" not in c:
        return None

    city = _extract_city(command)
    if city:
        location = geocode_city(city)
        if location is None:
            return persona.WEATHER_NOT_FOUND.format(city=city)
        return _weather_summary(location)

    if DEFAULT_LOCATION:
        return _weather_summary(DEFAULT_LOCATION)

    global _awaiting_city
    _awaiting_city = True
    return persona.WEATHER_ASK_CITY


def _extract_city(command):
    m = re.search(r"\bweather\s+(?:in|for|at)\s+([^?.,;]+)", command, re.IGNORECASE)
    if m:
        city = m.group(1).strip()
        return city or None
    return None


# ---------- Open-Meteo calls ----------

def geocode_city(city):
    resp = net.fetch(_GEOCODE_URL, params={
        "name": city, "count": 1, "language": "en", "format": "json",
    })
    if resp is None:
        return None
    try:
        results = resp.json().get("results") or []
        if not results:
            return None
        top = results[0]
        name = top.get("name") or city
        region = top.get("admin1") or top.get("country") or ""
        return {"name": f"{name}, {region}" if region else name,
                "lat": top["latitude"], "lon": top["longitude"]}
    except (ValueError, KeyError) as e:
        push_history(f"(weather geocode parse error: {e})")
        return None


def fetch_weather(lat, lon):
    resp = net.fetch(_FORECAST_URL, params={
        "latitude": lat, "longitude": lon,
        "current": "temperature_2m,weather_code",
        "daily": "temperature_2m_max,temperature_2m_min",
        "timezone": "auto", "forecast_days": 1,
    })
    if resp is None:
        return None
    try:
        return resp.json()
    except ValueError as e:
        push_history(f"(weather fetch parse error: {e})")
        return None


def _weather_summary(location):
    data = fetch_weather(location["lat"], location["lon"])
    if data is None:
        return persona.WEATHER_ERROR
    try:
        current = data["current"]
        cond = _code_to_text(current["weather_code"])
        temp = round(current["temperature_2m"])
        hi = round(data["daily"]["temperature_2m_max"][0])
        lo = round(data["daily"]["temperature_2m_min"][0])
    except (KeyError, IndexError, TypeError):
        return persona.WEATHER_ERROR
    return persona.WEATHER_SUMMARY.format(city=location["name"], temp=temp,
                                          cond=cond, hi=hi, lo=lo)


# WMO weather interpretation codes -> short spoken phrase
_CODE_TEXT = {
    0: "clear", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "foggy", 48: "foggy",
    51: "drizzling", 53: "drizzling", 55: "drizzling",
    56: "freezing drizzle", 57: "freezing drizzle",
    61: "lightly raining", 63: "raining", 65: "raining hard",
    66: "freezing rain", 67: "freezing rain",
    71: "lightly snowing", 73: "snowing", 75: "snowing hard", 77: "snowing",
    80: "rainy", 81: "raining", 82: "raining hard",
    85: "snowy", 86: "snowy",
    95: "thunderstorms", 96: "thunderstorms with hail", 99: "severe thunderstorms",
}


def _code_to_text(code):
    return _CODE_TEXT.get(code, "fair conditions")