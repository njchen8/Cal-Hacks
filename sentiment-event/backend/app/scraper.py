"""Utilities for scraping tweets and persisting them locally."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List

import requests
from sqlalchemy import select

from .config import settings
from .database import get_session
from .models import Tweet

SEARCH_URL = "https://api.twitter.com/2/tweets/search/recent"
MAX_RESULTS_PER_REQUEST = 100
TWEET_FIELDS = "created_at,lang,public_metrics"
USER_FIELDS = "username,name"


def _build_scrape_query(keyword: str) -> str:
    """Return the search query for the Twitter API."""
    base_query = keyword.strip()
    return f"{base_query} lang:en -is:retweet"


def scrape(keyword: str, limit: int | None = None) -> List[Tweet]:
    """Scrape tweets for a keyword via the Twitter API."""
    token = settings.twitter_bearer_token
    if not token:
        raise RuntimeError(
            "TWITTER_BEARER_TOKEN is not configured. Set it to your X API bearer token."
        )

    remaining = limit or settings.scrape_limit
    remaining = max(0, remaining)
    if remaining == 0:
        return []

    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": settings.twitter_app_user_agent,
    }

    params = {
        "query": _build_scrape_query(keyword),
        "tweet.fields": TWEET_FIELDS,
        "user.fields": USER_FIELDS,
        "expansions": "author_id",
    }

    tweets: List[Tweet] = []
    next_token = None

    while remaining > 0:
        params["max_results"] = min(remaining, MAX_RESULTS_PER_REQUEST)
        if next_token:
            params["next_token"] = next_token
        else:
            params.pop("next_token", None)

        response = requests.get(SEARCH_URL, headers=headers, params=params, timeout=15)
        if response.status_code >= 400:
            raise RuntimeError(
                f"Twitter API error {response.status_code}: {response.text}"
            )

        payload = response.json()
        data = payload.get("data", [])
        if not data:
            break

        users_lookup = {
            user["id"]: user
            for user in payload.get("includes", {}).get("users", [])
        }

        for raw in data:
            tweet_id = raw.get("id")
            if not tweet_id:
                continue

            metrics = raw.get("public_metrics", {})
            author = users_lookup.get(raw.get("author_id"))
            username = author.get("username") if author else None

            created_at_str = raw.get("created_at")
            if created_at_str:
                created_at = (
                    datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    .astimezone(timezone.utc)
                    .replace(tzinfo=None)
                )
            else:
                created_at = datetime.utcnow()

            tweets.append(
                Tweet(
                    tweet_id=tweet_id,
                    keyword=keyword,
                    username=username,
                    content=raw.get("text", ""),
                    language=raw.get("lang"),
                    created_at=created_at,
                    url=f"https://twitter.com/{username}/status/{tweet_id}" if username else None,
                    like_count=metrics.get("like_count"),
                    reply_count=metrics.get("reply_count"),
                    retweet_count=metrics.get("retweet_count"),
                    quote_count=metrics.get("quote_count"),
                )
            )

            remaining -= 1
            if remaining == 0:
                break

        next_token = payload.get("meta", {}).get("next_token")
        if not next_token:
            break

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
