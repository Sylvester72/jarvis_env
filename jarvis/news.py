"""News headlines from a small set of free RSS feeds (no paid news API key).

"what's the news" / "give me the headlines" pulls the top few items from a few
reputable general-news feeds and speaks them as short "source: headline" lines -
it's spoken aloud, so no long descriptions. The most recent headlines are cached
so "tell me more about <topic>" expands one of them from its feed description.

Fetches go through jarvis.net.fetch, which handles this machine's antivirus
TLS-interception fallback.
"""

import re

from jarvis import net
from jarvis import persona

# source label -> RSS feed URL (a small set of stable, reputable feeds)
FEEDS = (
    ("BBC News", "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ("The Guardian", "https://www.theguardian.com/world/rss"),
    ("NPR", "https://feeds.npr.org/1001/rss.xml"),
)

_MAX_HEADLINES = 5      # spoken at most this many
_PER_FEED = 2           # take the top N from each feed

_last_items = []        # most recent headlines, for "expand on that story"


def handle_news_command(command):
    """Route a news request. Returns a line to speak, or None if it isn't one
    (letting the dispatcher fall through to the AI)."""
    c = command.lower()
    if "news" in c or "headline" in c:
        return _summarize()
    # Expanding a story only makes sense right after showing the headlines.
    if _last_items and ("more about" in c or "tell me more" in c or "expand" in c):
        return _expand(command)
    return None


def _summarize():
    global _last_items
    _last_items = []
    for source, url in FEEDS:
        resp = net.fetch(url, timeout=15)
        if resp is None:
            continue
        try:
            items = _parse_feed(source, resp.text)
        except Exception:
            items = []
        _last_items.extend(items[:_PER_FEED])

    if not _last_items:
        return persona.NEWS_ERROR

    top = _last_items[:_MAX_HEADLINES]
    parts = (f"{item['source']}: {item['headline']}." for item in top)
    return persona.NEWS_SUMMARY.format(items=" ".join(parts))


def _expand(command):
    c = command.lower().strip().strip("?")
    topic = None
    for marker in ("tell me more about", "more about", "expand on", "expand the story about"):
        if marker in c:
            topic = c.split(marker, 1)[1].strip()
            break
    if not topic:
        return persona.NEWS_EXPAND_WHICH

    best = next((item for item in _last_items if topic in item["headline"].lower()), None)
    if best is None:
        return persona.NEWS_NOTHING_MORE
    summary = (best.get("summary") or "").strip() or "no further details are available"
    if len(summary) > 320:
        summary = summary[:320] + "…"
    return persona.NEWS_EXPANDED.format(headline=best["headline"], summary=summary)


# ---------- RSS parsing (stdlib ElementTree) ----------

_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text):
    text = _TAG_RE.sub("", text or "")
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&quot;", '"').replace("&#39;", "'")
    return re.sub(r"\s+", " ", text).strip()


def _parse_feed(source_name, xml_text):
    try:
        import xml.etree.ElementTree as ET
        root = ET.fromstring(xml_text)
    except Exception:
        return []
    items = []
    for item in root.iter("item"):
        headline = (item.findtext("title") or "").strip()
        if not headline:
            continue
        description = _strip_html(item.findtext("description") or "")
        items.append({
            "headline": headline,
            "summary": description,
            "source": source_name,
        })
    return items