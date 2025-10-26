"""High level pipeline routines for scraping and analyzing user content."""

from __future__ import annotations

from typing import Callable, Optional

from sqlalchemy import select

from .config import settings
from .database import get_session
from .models import Tweet
from .scraper import ScrapeResult, scrape_and_persist, update_export_with_sentiment
from . import scraper_reddit
from .sentiment import get_analyzer


def analyze_pending(
    limit: Optional[int] = None,
    keyword: Optional[str] = None,
    progress_callback: Optional[Callable[[int, int], None]] = None,
) -> int:
    """Analyze stored content items without sentiment and persist results.

    Returns the number of content items updated.
    """

    analyzer = get_analyzer()
    updated = 0

    with get_session() as session:
        stmt = select(Tweet).where(Tweet.sentiment.is_(None)).order_by(Tweet.created_at.desc())
        if keyword:
            stmt = stmt.where(Tweet.keyword == keyword)
        if limit:
            stmt = stmt.limit(limit)

        tweets = session.scalars(stmt).all()
        total = len(tweets)

        if progress_callback:
            progress_callback(0, total)

        for index, tweet in enumerate(tweets, start=1):
            tweet.sentiment = analyzer.analyze(tweet.content)
            updated += 1
            if progress_callback:
                progress_callback(index, total)

    return updated


def scrape(keyword: str, limit: Optional[int] = None) -> ScrapeResult:
    """Scrape new content for a keyword, honoring cached exports when available."""
    effective_limit = limit or settings.scrape_limit
    return scrape_and_persist(keyword, limit=effective_limit)


def scrape_and_analyze(keyword: str, limit: Optional[int] = None) -> tuple[ScrapeResult, int]:
    """Scrape content and immediately analyze the new entries when needed."""
    scrape_result = scrape(keyword, limit=limit)
    analyzed = 0 if scrape_result.used_cache else analyze_pending(keyword=keyword)
    if scrape_result.export_path:
        update_export_with_sentiment(scrape_result.export_path)
    return scrape_result, analyzed


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