"""Utilities for scraping tweets and persisting them locally using Twikit."""

from __future__ import annotations

import asyncio
import csv
import re
from datetime import datetime
from typing import Dict, Iterable, List, Optional

from sqlalchemy import select
from twikit import Client
from twikit.errors import Forbidden, NotFound, TwitterException, Unauthorized

from .config import settings
from .database import get_session
from .models import Tweet

_loop: Optional[asyncio.AbstractEventLoop] = None


def _parse_cookie_header(header: str) -> Dict[str, str]:
    """Convert a cookie header string into a dictionary of cookie values."""

    cookies: Dict[str, str] = {}
    for part in header.split(";"):
        token = part.strip()
        if not token or "=" not in token:
            continue
        name, value = token.split("=", 1)
        value = value.strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        value = value.replace('\\"', '"')
        cookies[name.strip()] = value
    return cookies


def _validate_session(client: Client) -> bool:
    """Return True if the authenticated session appears to be valid."""

    try:
        _run_async(client.user_id())
    except Unauthorized:
        return False
    except NotFound:
        return True
    except Exception:  # pragma: no cover - best-effort validation
        return False
    return True


def _run_async(coro):
    """Execute a Twikit coroutine in a synchronous context."""

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        return asyncio.run_coroutine_threadsafe(coro, loop).result()

    global _loop
    if _loop is None or _loop.is_closed():
        _loop = asyncio.new_event_loop()
    return _loop.run_until_complete(coro)


def _ensure_authenticated_client() -> Client:
    """Return an authenticated Twikit client, logging in if necessary."""

    client = Client("en-US", user_agent=settings.twitter_user_agent)
    cookie_path = settings.resolved_cookie_path

    if settings.twitter_cookie_header:
        cookies = _parse_cookie_header(settings.twitter_cookie_header)
        if cookies:
            client.set_cookies(cookies, clear_cookies=True)
            if _validate_session(client):
                try:
                    cookie_path.parent.mkdir(parents=True, exist_ok=True)
                    client.save_cookies(str(cookie_path))
                except Exception:
                    pass
                return client

    if cookie_path.exists():
        client.load_cookies(str(cookie_path))
        if _validate_session(client):
            return client

    if not settings.twitter_username or not settings.twitter_password:
        raise RuntimeError(
            "Twikit requires either valid cookies (TWITTER_COOKIE_HEADER/TWITTER_COOKIE_FILE) "
            "or TWITTER_USERNAME and TWITTER_PASSWORD to authenticate."
        )

    try:
        _run_async(
            client.login(
                auth_info_1=settings.twitter_username,
                password=settings.twitter_password,
                cookies_file=str(cookie_path),
            )
        )
    except Forbidden as exc:
        raise RuntimeError(
            "Twikit login was blocked by Twitter. Provide fresh cookies via TWITTER_COOKIE_HEADER "
            "or TWITTER_COOKIE_FILE and try again."
        ) from exc
    except TwitterException as exc:
        raise RuntimeError(f"Twikit login failed: {exc}") from exc

    cookie_path.parent.mkdir(parents=True, exist_ok=True)
    client.save_cookies(str(cookie_path))
    if not _validate_session(client):
        raise RuntimeError(
            "Twikit authentication could not be verified. Provide valid session cookies via "
            "TWITTER_COOKIE_HEADER or TWITTER_COOKIE_FILE and try again."
        )
    return client


def scrape(keyword: str, limit: int | None = None) -> List[Tweet]:
    """Scrape tweets for a keyword and return unsaved Tweet instances."""

    query = keyword.strip() or settings.default_keyword
    if not query:
        return []

    limit = limit or settings.scrape_limit
    if limit <= 0:
        return []

    client = _ensure_authenticated_client()
    remaining = limit
    cursor: Optional[str] = None
    tweets: List[Tweet] = []

    while remaining > 0:
        batch_size = min(remaining, 20)
        try:
            results = _run_async(
                client.search_tweet(
                    query,
                    product="Latest",
                    count=batch_size,
                    cursor=cursor,
                )
            )
        except NotFound:
            break
        except TwitterException as exc:
            raise RuntimeError(f"Twikit search failed: {exc}") from exc

        if not results:
            break

        for tweet in results:
            username = None
            if getattr(tweet, "user", None):
                username = getattr(tweet.user, "screen_name", None) or getattr(tweet.user, "username", None)

            created_at = getattr(tweet, "created_at_datetime", None) or getattr(tweet, "created_at", None)
            if isinstance(created_at, datetime):
                created_at = created_at.replace(tzinfo=None)
            else:
                created_at = datetime.utcnow()

            tweets.append(
                Tweet(
                    tweet_id=str(getattr(tweet, "id", getattr(tweet, "id_str", ""))),
                    keyword=keyword,
                    username=username,
                    content=getattr(tweet, "full_text", getattr(tweet, "text", "")),
                    language=getattr(tweet, "lang", None),
                    created_at=created_at,
                    url=f"https://twitter.com/{username}/status/{getattr(tweet, 'id', '')}" if username else None,
                    like_count=getattr(tweet, "favorite_count", None),
                    reply_count=getattr(tweet, "reply_count", None),
                    retweet_count=getattr(tweet, "retweet_count", None),
                    quote_count=getattr(tweet, "quote_count", None),
                )
            )

            remaining -= 1
            if remaining == 0:
                break

        cursor = getattr(results, "next_cursor", None)
        if not cursor:
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
    _export_to_csv(tweets, keyword)
    return persist(tweets)


def _export_to_csv(tweets: Iterable[Tweet], keyword: str) -> Optional[str]:
    """Write the scraped tweets to a CSV file for easy inspection."""

    tweets = list(tweets)
    if not tweets:
        return None

    exports_dir = settings.data_dir / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)

    slug = re.sub(r"[^\w-]+", "_", keyword.strip().lower()) or "search"
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    filepath = exports_dir / f"{slug}_{timestamp}.csv"

    fieldnames = [
        "tweet_id",
        "keyword",
        "username",
        "content",
        "language",
        "created_at",
        "url",
        "like_count",
        "reply_count",
        "retweet_count",
        "quote_count",
    ]

    with filepath.open("w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for tweet in tweets:
            writer.writerow(
                {
                    "tweet_id": tweet.tweet_id,
                    "keyword": tweet.keyword,
                    "username": tweet.username or "",
                    "content": tweet.content or "",
                    "language": tweet.language or "",
                    "created_at": tweet.created_at.isoformat() if tweet.created_at else "",
                    "url": tweet.url or "",
                    "like_count": tweet.like_count if tweet.like_count is not None else "",
                    "reply_count": tweet.reply_count if tweet.reply_count is not None else "",
                    "retweet_count": tweet.retweet_count if tweet.retweet_count is not None else "",
                    "quote_count": tweet.quote_count if tweet.quote_count is not None else "",
                }
            )

    return str(filepath)
