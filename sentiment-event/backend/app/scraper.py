"""Utilities for scraping tweets and persisting them locally."""

from __future__ import annotations

from datetime import datetime
from typing import Iterable, List

import snscrape.modules.twitter as sntwitter
from sqlalchemy import select

from .config import settings
from .database import get_session
from .models import Tweet


def _build_scrape_query(keyword: str) -> str:
    """Return the search query for snscrape."""
    base_query = keyword.strip()
    # Restrict to English messages for the MVP and exclude retweets for cleaner signals.
    return f"{base_query} lang:en -is:retweet"


def scrape(keyword: str, limit: int | None = None) -> List[Tweet]:
    """Scrape tweets for a keyword and return unsaved Tweet instances."""
    limit = limit or settings.scrape_limit
    query = _build_scrape_query(keyword)
    scraper = sntwitter.TwitterSearchScraper(query)

    tweets: List[Tweet] = []
    for count, tweet in enumerate(scraper.get_items(), start=1):
        if limit and count > limit:
            break

        tweets.append(
            Tweet(
                tweet_id=str(tweet.id),
                keyword=keyword,
                username=tweet.user.username if tweet.user else None,
                content=tweet.rawContent,
                language=tweet.lang,
                created_at=tweet.date.replace(tzinfo=None) if isinstance(tweet.date, datetime) else datetime.utcnow(),
                url=f"https://twitter.com/{tweet.user.username}/status/{tweet.id}" if tweet.user else None,
                like_count=tweet.likeCount,
                reply_count=tweet.replyCount,
                retweet_count=tweet.retweetCount,
                quote_count=tweet.quoteCount,
            )
        )
    return tweets


def persist(tweets: Iterable[Tweet]) -> int:
    """Persist new tweets into the database, skipping duplicates."""
    tweets = list(tweets)
    if not tweets:
        return 0

    tweet_ids = [tweet.tweet_id for tweet in tweets]

    with get_session() as session:
        existing_ids = {
            existing_id
            for (existing_id,) in session.execute(
                select(Tweet.tweet_id).where(Tweet.tweet_id.in_(tweet_ids))
            )
        }

        new_records = [tweet for tweet in tweets if tweet.tweet_id not in existing_ids]
        session.add_all(new_records)

        return len(new_records)


def scrape_and_persist(keyword: str, limit: int | None = None) -> int:
    """Convenience helper to scrape tweets and store them locally."""
    tweets = scrape(keyword, limit=limit)
    return persist(tweets)
