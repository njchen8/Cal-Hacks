"""Utilities for scraping user content and persisting it locally using Twikit."""

from __future__ import annotations

import asyncio
import csv
import json
import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy import select
from twikit import Client
from twikit.errors import Forbidden, NotFound, TwitterException, Unauthorized

from .config import settings
from .database import get_session
from .models import Tweet

RECENT_EXPORT_WINDOW = timedelta(minutes=10)

EXPORT_BASE_FIELDS = [
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

SENTIMENT_EXPORT_FIELDS = [
    "sentiment_primary_positive",
    "sentiment_primary_negative",
    "sentiment_primary_neutral",
    "sentiment_primary_label",
    "sentiment_primary_confidence",
    "sentiment_signals_positive",
    "sentiment_signals_negative",
    "sentiment_signals_neutral",
]


@dataclass
class ScrapeResult:
    """Outcome metadata for a scrape-and-persist operation."""

    stored_count: int
    fetched_count: int
    export_path: Optional[Path]
    status: str
    message: str
    used_cache: bool = False

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
    """Scrape user content for a keyword and return unsaved records."""

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
    search_query = query
    if " " in search_query and '"' not in search_query:
        search_query = f'"{search_query}"'

    target_count = remaining
    if target_count > 0:
        print(f"[twitter] Starting scrape batch; targeting up to {target_count} tweets...", flush=True)

    while remaining > 0:
        batch_size = min(remaining, 30)
        try:
            results = _run_async(
                client.search_tweet(
                    search_query,
                    product="Latest",
                    count=batch_size,
                    cursor=cursor,
                )
            )
        except TwitterException as exc:
            if isinstance(exc, NotFound):
                break
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
            if target_count > 0:
                fetched = target_count - remaining
                report_interval = max(1, target_count // 5)
                if fetched == 1 or fetched == target_count or fetched % report_interval == 0:
                    print(
                        f"[twitter] Progress: {fetched}/{target_count} tweets fetched.",
                        flush=True,
                    )
            if remaining == 0:
                break

        cursor = getattr(results, "next_cursor", None)
        if not cursor:
            break

        if remaining > 0:
            time.sleep(1.5)

    # Gentle pause between batches to reduce scrape pressure and stay region-friendly
    time.sleep(1.5)

    if target_count > 0:
        fetched_total = target_count - remaining
        print(
            f"[twitter] Finished scraping: fetched {fetched_total}/{target_count} tweets.",
            flush=True,
        )

    return tweets


def persist(tweets: Iterable[Tweet]) -> int:
    """Persist new content entries into the database, skipping duplicates."""
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


def scrape_and_persist(keyword: str, limit: int | None = None, *, ignore_cache: bool = False) -> ScrapeResult:
    """Scrape content, manage exports, and persist new records."""

    slug = _slugify(keyword)
    latest_export = _find_latest_export(slug)
    now = datetime.utcnow()

    if latest_export and not ignore_cache:
        latest_path, latest_timestamp = latest_export
        if now - latest_timestamp <= RECENT_EXPORT_WINDOW:
            return ScrapeResult(
                stored_count=0,
                fetched_count=0,
                export_path=latest_path,
                status="cached",
                message=f"Pulled cached export from {latest_path.name}.",
                used_cache=True,
            )

    append_target = latest_export[0] if latest_export else None
    tweets = scrape(keyword, limit=limit)
    fetched_count = len(tweets)

    if not tweets:
        return ScrapeResult(
            stored_count=0,
            fetched_count=0,
            export_path=append_target,
            status="skipped",
            message="No new content fetched.",
            used_cache=False,
        )

    export_path, export_status = _export_to_csv(tweets, keyword, append_target)
    stored_count = persist(tweets)

    if export_status == "appended" and export_path is not None:
        message = f"Appended {stored_count} new content entries to {export_path.name}."
    elif export_status == "created" and export_path is not None:
        if stored_count:
            message = f"Stored {stored_count} new content entries to {export_path.name}."
        else:
            message = f"Created {export_path.name} with no new unique content entries."
    else:
        message = "No new content persisted."

    return ScrapeResult(
        stored_count=stored_count,
        fetched_count=fetched_count,
        export_path=export_path,
        status=export_status,
        message=message,
        used_cache=False,
    )


def _export_to_csv(tweets: Iterable[Tweet], keyword: str, append_target: Optional[Path]) -> Tuple[Optional[Path], str]:
    """Write scraped content to CSV, appending to the most recent export when available."""

    tweets = list(tweets)
    if not tweets:
        return append_target, "skipped"

    exports_dir = settings.data_dir / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)

    if append_target and append_target.exists():
        filepath = append_target
        mode = "a"
        write_header = False
        status = "appended"
    else:
        slug = _slugify(keyword)
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        filepath = exports_dir / f"{slug}_{timestamp}.csv"
        mode = "w"
        write_header = True
        status = "created"

    with filepath.open(mode, newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=EXPORT_BASE_FIELDS)
        if write_header:
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

    return filepath, status


def update_export_with_sentiment(export_path: Optional[Path]) -> None:
    """Rewrite an export CSV to include sentiment metadata columns."""

    if export_path is None:
        return

    export_path = Path(export_path)
    if not export_path.exists():
        return

    with export_path.open("r", newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        original_fieldnames = reader.fieldnames or []
        rows = list(reader)

    if not rows:
        return

    tweet_ids = [row.get("tweet_id") for row in rows if row.get("tweet_id")]
    if not tweet_ids:
        return

    with get_session() as session:
        stmt = select(Tweet).where(Tweet.tweet_id.in_(tweet_ids))
        tweet_map = {tweet.tweet_id: tweet for tweet in session.scalars(stmt)}

    fieldnames = list(original_fieldnames)
    for column in SENTIMENT_EXPORT_FIELDS:
        if column not in fieldnames:
            fieldnames.append(column)

    for row in rows:
        tweet = tweet_map.get(row.get("tweet_id"))
        sentiment = tweet.sentiment if tweet and isinstance(tweet.sentiment, dict) else {}
        primary = sentiment.get("primary") or {}
        signals = sentiment.get("signals") or {}

        row["sentiment_primary_positive"] = _format_float(primary.get("positive"))
        row["sentiment_primary_negative"] = _format_float(primary.get("negative"))
        row["sentiment_primary_neutral"] = _format_float(primary.get("neutral"))
        row["sentiment_primary_label"] = primary.get("label", "") if isinstance(primary.get("label"), str) else ""
        row["sentiment_primary_confidence"] = _format_float(primary.get("confidence"))

        row["sentiment_signals_positive"] = _format_signal_bucket(signals.get("positive"))
        row["sentiment_signals_negative"] = _format_signal_bucket(signals.get("negative"))
        row["sentiment_signals_neutral"] = _format_signal_bucket(signals.get("neutral"))

    with export_path.open("w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def _format_float(value: object) -> str:
    if isinstance(value, (int, float)):
        return f"{float(value):.6f}"
    return ""


def _format_signal_bucket(bucket: object) -> str:
    if not isinstance(bucket, dict):
        return ""
    formatted = {str(label): float(score) for label, score in bucket.items() if isinstance(score, (int, float))}
    if not formatted:
        return ""
    return json.dumps(formatted, ensure_ascii=False)


def _slugify(keyword: str) -> str:
    return re.sub(r"[^\w-]+", "_", keyword.strip().lower()) or "search"


def _find_latest_export(slug: str) -> Optional[Tuple[Path, datetime]]:
    exports_dir = settings.data_dir / "exports"
    if not exports_dir.exists():
        return None

    pattern = re.compile(rf"^{re.escape(slug)}_(\d{{14}})\.csv$")
    latest_path: Optional[Path] = None
    latest_timestamp: Optional[datetime] = None

    for filepath in exports_dir.glob(f"{slug}_*.csv"):
        match = pattern.match(filepath.name)
        if not match:
            continue
        timestamp = datetime.strptime(match.group(1), "%Y%m%d%H%M%S")
        if latest_timestamp is None or timestamp > latest_timestamp:
            latest_path = filepath
            latest_timestamp = timestamp

    if latest_path and latest_timestamp:
        return latest_path, latest_timestamp

    return None
