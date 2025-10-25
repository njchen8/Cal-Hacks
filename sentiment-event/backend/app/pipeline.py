"""High level pipeline routines for scraping and analyzing tweets.

Supports both Twitter (original) and Reddit (alternative) as data sources.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select

from .config import settings
from .database import get_session
from .models import Tweet
from .scraper import scrape_and_persist  # Twitter scraper (original)
from . import scraper_reddit  # Reddit scraper (alternative)
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
    """Scrape new tweets for a keyword and persist them (Twitter source)."""
    return scrape_and_persist(keyword, limit=limit or settings.scrape_limit)


def scrape_and_analyze(keyword: str, limit: Optional[int] = None) -> tuple[int, int]:
    """Scrape tweets and immediately analyze the new content (Twitter source)."""
    stored = scrape(keyword, limit=limit)
    analyzed = analyze_pending(keyword=keyword)
    return stored, analyzed


# ============================================================================
# REDDIT-SPECIFIC PIPELINE FUNCTIONS (Alternative source)
# ============================================================================

def scrape_reddit(keyword: str, limit: Optional[int] = None, subreddit: str = "all") -> int:
    """Scrape new Reddit posts for a keyword and persist them (Reddit source).

    Args:
        keyword: Search term
        limit: Max posts to fetch
        subreddit: Which subreddit to search (default: "all")

    Returns:
        Number of new posts stored
    """
    return scraper_reddit.scrape_and_persist(keyword, limit=limit or settings.scrape_limit, subreddit=subreddit)


def scrape_and_analyze_reddit(keyword: str, limit: Optional[int] = None, subreddit: str = "all") -> tuple[int, int]:
    """Scrape Reddit posts and immediately analyze the new content (Reddit source).

    Args:
        keyword: Search term
        limit: Max posts to fetch
        subreddit: Which subreddit to search (default: "all")

    Returns:
        Tuple of (posts stored, posts analyzed)
    """
    stored = scrape_reddit(keyword, limit=limit, subreddit=subreddit)
    analyzed = analyze_pending()
    return stored, analyzed
