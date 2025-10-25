"""High level pipeline routines for scraping and analyzing tweets."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select

from .config import settings
from .database import get_session
from .models import Tweet
from .scraper import scrape_and_persist
from .sentiment import get_analyzer


def analyze_pending(limit: Optional[int] = None, keyword: Optional[str] = None) -> int:
    """Analyze tweets without sentiment and persist results.

    Returns the number of tweets updated.
    """

    analyzer = get_analyzer()
    updated = 0

    with get_session() as session:
        stmt = select(Tweet).where(Tweet.sentiment.is_(None)).order_by(Tweet.created_at.desc())
        if keyword:
            stmt = stmt.where(Tweet.keyword == keyword)
        if limit:
            stmt = stmt.limit(limit)

        for tweet in session.scalars(stmt):
            tweet.sentiment = analyzer.analyze(tweet.content)
            updated += 1

    return updated


def scrape(keyword: str, limit: Optional[int] = None) -> int:
    """Scrape new tweets for a keyword and persist them."""
    return scrape_and_persist(keyword, limit=limit or settings.scrape_limit)


def scrape_and_analyze(keyword: str, limit: Optional[int] = None) -> tuple[int, int]:
    """Scrape tweets and immediately analyze the new content."""
    stored = scrape(keyword, limit=limit)
    analyzed = analyze_pending(keyword=keyword)
    return stored, analyzed
