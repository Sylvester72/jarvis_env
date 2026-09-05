"""News headlines: RSS fetch/summarize, source labels, expansion from cache,
and handling of feed failures (including this machine's TLS fallback via
net.fetch). Network is stubbed."""

import pytest

from jarvis import news, persona


@pytest.fixture
def isolated_news(monkeypatch):
    monkeypatch.setattr(news, "_last_items", [])
    yield
    monkeypatch.setattr(news, "_last_items", [])


class _Resp:
    def __init__(self, text):
        self.text = text


def _clean_rss():
    return (
        '<?xml version="1.0"?><rss version="2.0"><channel>'
        "<item><title>Story Alpha</title>"
        "<description>&lt;p&gt;Details about alpha events.&lt;/p&gt;</description>"
        "<link>http://x/1</link></item>"
        "<item><title>Story Beta</title><description>Second beta details.</description></item>"
        "<item><title>Story Gamma</title><description>Gamma details.</description></item>"
        "</channel></rss>"
    )


def _stub_feed(monkeypatch):
    monkeypatch.setattr(news.net, "fetch", lambda *a, **k: _Resp(_clean_rss()))


def test_non_news_returns_none(isolated_news):
    assert news.handle_news_command("what's the weather") is None


def test_news_summary_mentions_sources_and_expansion(isolated_news, monkeypatch):
    _stub_feed(monkeypatch)
    reply = news.handle_news_command("what's the news")
    assert "BBC News: Story Alpha" in reply
    assert "The Guardian" in reply
    assert "expand" in reply  # mentions the expansion offer


def test_headlines_phrase(isolated_news, monkeypatch):
    _stub_feed(monkeypatch)
    reply = news.handle_news_command("give me the headlines")
    assert "Story Alpha" in reply


def test_all_feeds_down_returns_error(isolated_news, monkeypatch):
    monkeypatch.setattr(news.net, "fetch", lambda *a, **k: None)
    assert news.handle_news_command("what's the news") == persona.NEWS_ERROR


def test_parse_feed_strips_html_tags(isolated_news):
    items = news._parse_feed("BBC News", _clean_rss())
    assert items[0]["headline"] == "Story Alpha"
    assert items[0]["summary"] == "Details about alpha events."
    assert items[0]["source"] == "BBC News"


def test_expand_returns_summary_for_matching_headline(isolated_news, monkeypatch):
    _stub_feed(monkeypatch)
    news.handle_news_command("what's the news")  # populates the cache
    reply = news.handle_news_command("tell me more about alpha")
    assert "Story Alpha" in reply
    assert "alpha events" in reply


def test_expand_unknown_topic(isolated_news, monkeypatch):
    _stub_feed(monkeypatch)
    news.handle_news_command("what's the news")
    assert news.handle_news_command("more about zzzz") == persona.NEWS_NOTHING_MORE


def test_expand_without_cache_falls_through(isolated_news):
    # No headlines fetched, so expansion has nothing to work from -> None.
    assert news.handle_news_command("tell me more about alpha") is None