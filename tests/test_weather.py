"""Weather: routing, the one-time default-city prompt, geocoding/fetch
(summarized, not raw JSON), and location persistence. Network calls are stubbed
so tests never hit Open-Meteo."""

import pytest

from jarvis import persona, weather


@pytest.fixture
def isolated_weather(tmp_path, monkeypatch):
    monkeypatch.setattr(weather, "LOCATION_PATH", str(tmp_path / "weather_location.json"))
    monkeypatch.setattr(weather, "DEFAULT_LOCATION", None)
    monkeypatch.setattr(weather, "_awaiting_city", False)
    yield
    monkeypatch.setattr(weather, "DEFAULT_LOCATION", None)
    monkeypatch.setattr(weather, "_awaiting_city", False)


def _fake_location(city):
    return {"name": city, "lat": 51.5, "lon": -0.1}


def _fake_forecast(lat, lon):
    return {
        "current": {"temperature_2m": 72.4, "weather_code": 0},
        "daily": {"temperature_2m_max": [75.2], "temperature_2m_min": [59.8]},
    }


def _stub_network(monkeypatch):
    def geocode(name):
        return {"name": f"{name}, England", "lat": 51.5, "lon": -0.1}
    monkeypatch.setattr(weather, "geocode_city", geocode)
    monkeypatch.setattr(weather, "fetch_weather", _fake_forecast)


# ---------- routing ----------

def test_non_weather_command_returns_none(isolated_weather):
    assert weather.handle_weather_command("what's the time") is None


def test_weather_in_city_returns_summary(isolated_weather, monkeypatch):
    _stub_network(monkeypatch)
    reply = weather.handle_weather_command("what's the weather in London")
    assert reply == ("In London, England it's currently 72° and clear, "
                     "with a high of 75° and a low of 60° today.")


def test_weather_in_city_with_punctuation(isolated_weather, monkeypatch):
    _stub_network(monkeypatch)
    reply = weather.handle_weather_command("what's the weather in Paris?")
    assert "Paris" in reply


def test_weather_uses_saved_default(isolated_weather, monkeypatch):
    _stub_network(monkeypatch)
    weather.DEFAULT_LOCATION = _fake_location("Paris")
    reply = weather.handle_weather_command("what's the weather")
    assert reply.startswith("In Paris")


def test_weather_without_default_asks_for_city(isolated_weather):
    reply = weather.handle_weather_command("what's the weather")
    assert reply == persona.WEATHER_ASK_CITY
    assert weather.is_awaiting_city()


# ---------- one-time default-city prompt ----------

def test_consume_city_answer_sets_default_and_answers(isolated_weather, monkeypatch):
    _stub_network(monkeypatch)
    weather._awaiting_city = True
    reply = weather.consume_city_answer("London")
    assert weather.is_awaiting_city() is False
    assert weather.DEFAULT_LOCATION["name"] == "London, England"
    assert "London" in reply


def test_consume_city_answer_skip(isolated_weather):
    weather._awaiting_city = True
    reply = weather.consume_city_answer("never mind")
    assert reply == persona.WEATHER_CITY_SKIPPED
    assert weather.is_awaiting_city() is False


def test_consume_city_answer_not_awaiting_is_noop(isolated_weather):
    assert weather.consume_city_answer("hello") is None


def test_geocode_failure_reports_not_found(isolated_weather, monkeypatch):
    monkeypatch.setattr(weather, "geocode_city", lambda name: None)
    reply = weather.handle_weather_command("what's the weather in Nonsenseville")
    assert reply == persona.WEATHER_NOT_FOUND.format(city="Nonsenseville")


# ---------- persistence ----------

def test_location_round_trip(isolated_weather):
    weather._save_default_location({"name": "Paris", "lat": 48.8, "lon": 2.35})
    weather.DEFAULT_LOCATION = None
    weather.load_default_location()
    assert weather.DEFAULT_LOCATION == {"name": "Paris", "lat": 48.8, "lon": 2.35}


def test_missing_location_file_loads_none(isolated_weather):
    weather.load_default_location()
    assert weather.DEFAULT_LOCATION is None


# ---------- code mapping ----------

def test_weather_code_mapping():
    assert weather._code_to_text(0) == "clear"
    assert weather._code_to_text(63) == "raining"
    assert weather._code_to_text(999) == "fair conditions"
