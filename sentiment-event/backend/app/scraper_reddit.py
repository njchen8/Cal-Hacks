"""Utilities for scraping Reddit posts and persisting them locally.

This is a parallel implementation to scraper.py (Twitter) for Reddit as an alternative source.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List
import time

import praw
from sqlalchemy import select

from .config import settings
from .database import get_session
from .models import Tweet  # Reusing Tweet model for Reddit posts

# ============================================================================
# REDDIT-SPECIFIC CONFIGURATION
# ============================================================================

def _build_search_query(keyword: str) -> str:
    """Return the search query for Reddit API."""
    return keyword.strip()


def scrape(keyword: str, limit: int | None = None, subreddit: str = "all") -> List[Tweet]:
    """Scrape Reddit posts for a keyword via the Reddit API.

    Args:
        keyword: Search term to look for
        limit: Maximum number of posts to fetch
        subreddit: Which subreddit(s) to search (default: "all")

    Returns:
        List of Tweet objects (reusing same model for Reddit posts)
    """
    # ============================================================================
    # REDDIT API AUTHENTICATION - Check credentials
    # ============================================================================
    client_id = settings.reddit_client_id
    client_secret = settings.reddit_client_secret
    user_agent = settings.reddit_user_agent

    if not client_id or not client_secret:
        raise RuntimeError(
            "REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET are not configured. "
            "Set them in your .env file. Get credentials from: "
            "https://www.reddit.com/prefs/apps"
        )

    remaining = limit or settings.scrape_limit
    remaining = max(0, remaining)
    if remaining == 0:
        return []

    target_count = remaining

    # ============================================================================
    # REDDIT API CLIENT INITIALIZATION
    # ============================================================================
    reddit = praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
    )

    posts: List[Tweet] = []

    # ============================================================================
    # REDDIT SEARCH AND DATA EXTRACTION
    # ============================================================================
    try:
        # Search in specified subreddit
        subreddit_obj = reddit.subreddit(subreddit)
        search_results = subreddit_obj.search(
            query=_build_search_query(keyword),
            sort='relevance',
            time_filter='month',  # Posts from last month
            limit=remaining
        )

        for submission in search_results:
            if remaining <= 0:
                break

            # Convert Reddit post to Tweet model format
            post_id = submission.id
            username = str(submission.author) if submission.author else "[deleted]"

            # Combine title and selftext for full content
            content = submission.title
            if submission.selftext:
                content += f"\n\n{submission.selftext}"

            created_at = datetime.fromtimestamp(
                submission.created_utc,
                tz=timezone.utc
            ).replace(tzinfo=None)

            posts.append(
                Tweet(
                    tweet_id=f"reddit_{post_id}",  # Prefix to distinguish from Twitter
                    keyword=keyword,
                    username=username,
                    content=content[:10000],  # Limit content length
                    language="en",  # Reddit doesn't provide language detection
                    created_at=created_at,
                    url=f"https://reddit.com{submission.permalink}",
                    like_count=submission.score,  # Upvotes as "likes"
                    reply_count=submission.num_comments,
                    retweet_count=0,  # Reddit doesn't have retweets
                    quote_count=0,  # Reddit doesn't have quotes
                )
            )

            remaining -= 1

            fetched = target_count - remaining
            if target_count > 0:
                report_interval = max(1, target_count // 5)
                if fetched == 1 or fetched == target_count or fetched % report_interval == 0:
                    print(
                        f"[reddit] Progress: {fetched}/{target_count} posts fetched (sleeping to respect rate limits)...",
                        flush=True,
                    )

            # Add delay to respect rate limits and avoid blocking
            # Reddit free tier: be conservative to avoid IP bans
            if remaining > 0:
                time.sleep(2.0)  # ~30 requests per minute (safer than 100/min)

    except Exception as e:
        raise RuntimeError(f"Reddit API error: {str(e)}")

    return posts


def persist(posts: Iterable[Tweet]) -> int:
    """Persist new Reddit posts into the database, skipping duplicates.

    Reuses the same persist logic as Twitter scraper.
    """
    posts = list(posts)
    if not posts:
        return 0

    post_ids = [post.tweet_id for post in posts]

    with get_session() as session:
        existing_ids = {
            existing_id
            for (existing_id,) in session.execute(
                select(Tweet.tweet_id).where(Tweet.tweet_id.in_(post_ids))
            )
        }

        new_records = [post for post in posts if post.tweet_id not in existing_ids]
        session.add_all(new_records)

        return len(new_records)


def scrape_and_persist(keyword: str, limit: int | None = None, subreddit: str = "all") -> int:
    """Convenience helper to scrape Reddit posts and store them locally.

    Args:
        keyword: Search term
        limit: Max posts to fetch
        subreddit: Which subreddit to search (default: "all")

    Returns:
        Number of new posts stored
    """
    posts = scrape(keyword, limit=limit, subreddit=subreddit)
    return persist(posts)
