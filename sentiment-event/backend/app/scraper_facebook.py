"""Utilities for scraping Facebook posts and persisting them locally.

This is a parallel implementation to scraper.py (Twitter) and scraper_reddit.py for Facebook as an alternative source.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List
import time

import requests
from sqlalchemy import select

from .config import settings
from .database import get_session
from .models import Tweet  # Reusing Tweet model for Facebook posts

# ============================================================================
# FACEBOOK-SPECIFIC CONFIGURATION
# ============================================================================

def _build_search_query(keyword: str, page_id: str | None = None) -> str:
    """Return the search query for Facebook Graph API.

    Args:
        keyword: Search term to look for in posts
        page_id: Optional Facebook page ID to search within

    Returns:
        Query string for Facebook Graph API
    """
    return keyword.strip()


def scrape(keyword: str, limit: int | None = None, page_id: str | None = None) -> List[Tweet]:
    """Scrape Facebook posts for a keyword via the Facebook Graph API.

    Args:
        keyword: Search term to look for
        limit: Maximum number of posts to fetch
        page_id: Optional Facebook page ID to search (default: None = search all accessible pages)

    Returns:
        List of Tweet objects (reusing same model for Facebook posts)

    Note:
        Facebook Graph API requires Page Public Content Access permission for broad searches.
        Without approval, you can only access pages you manage.
    """
    # ============================================================================
    # FACEBOOK API AUTHENTICATION - Check credentials
    # ============================================================================
    access_token = settings.facebook_access_token
    app_id = settings.facebook_app_id
    app_secret = settings.facebook_app_secret

    if not access_token:
        raise RuntimeError(
            "FACEBOOK_ACCESS_TOKEN is not configured. "
            "Set it in your .env file. Get credentials from: "
            "https://developers.facebook.com/tools/explorer"
        )

    if not limit:
        limit = settings.scrape_limit

    posts = []
    remaining = limit

    # ============================================================================
    # FACEBOOK GRAPH API - Fetch posts
    # ============================================================================
    try:
        # Determine API endpoint based on whether we have a specific page ID
        if page_id:
            # Search within a specific page
            base_url = f"https://graph.facebook.com/v22.0/{page_id}/posts"
        else:
            # Note: Searching across all public pages requires Page Public Content Access
            # For now, we'll use the user's feed as a fallback
            base_url = "https://graph.facebook.com/v22.0/me/feed"

        # API parameters - always fetch 100 posts per call (Facebook's max) to minimize API calls
        params = {
            "access_token": access_token,
            "fields": "id,message,created_time,from,reactions.summary(total_count),comments.summary(total_count),shares,permalink_url",
            "limit": 100  # Always fetch max (100) to reduce number of API calls
        }

        # If searching for keyword, add it to params
        if keyword and page_id:
            # Note: Facebook doesn't support keyword search in posts directly
            # We'll fetch posts and filter client-side
            pass

        next_url = base_url
        posts_fetched = 0

        while posts_fetched < limit and next_url:
            response = requests.get(next_url, params=params if next_url == base_url else {})
            response.raise_for_status()

            data = response.json()

            if "data" not in data:
                break

            posts_fetched += len(data["data"])  # Track all posts fetched from API

            # Process all posts from this batch
            for post in data["data"]:
                # Filter by keyword if provided
                message = post.get("message", "")
                if keyword and keyword.lower() not in message.lower():
                    continue

                if len(posts) >= limit:
                    break

                # Extract post data
                post_id = post.get("id", "")
                content = message

                # Parse created_time (ISO format)
                created_str = post.get("created_time", "")
                try:
                    created_at = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                    created_at = created_at.replace(tzinfo=None)
                except:
                    created_at = datetime.now()

                # Extract from (author) info
                from_data = post.get("from", {})
                username = from_data.get("name", "Unknown")

                # Extract engagement metrics
                reactions_count = post.get("reactions", {}).get("summary", {}).get("total_count", 0)
                comments_count = post.get("comments", {}).get("summary", {}).get("total_count", 0)
                shares_count = post.get("shares", {}).get("count", 0) if post.get("shares") else 0

                # Get permalink
                permalink = post.get("permalink_url", f"https://facebook.com/{post_id}")

                posts.append(
                    Tweet(
                        tweet_id=f"facebook_{post_id}",  # Prefix to distinguish from Twitter/Reddit
                        keyword=keyword,
                        username=username,
                        content=content[:10000],  # Limit content length
                        language="en",  # Facebook doesn't provide language detection in basic API
                        created_at=created_at,
                        url=permalink,
                        like_count=reactions_count,
                        reply_count=comments_count,
                        retweet_count=shares_count,
                        quote_count=0,  # Facebook doesn't have quote posts
                    )
                )

            # Add delay to respect rate limits
            # Facebook Graph API: 200 calls per hour per user
            time.sleep(2.0)  # ~30 requests per minute (safer rate)

            # Check for pagination
            next_url = data.get("paging", {}).get("next")
            params = {}  # Next URL already includes params

    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Facebook API error: {str(e)}")

    return posts


def persist(posts: Iterable[Tweet]) -> int:
    """Persist new Facebook posts into the database, skipping duplicates.

    Args:
        posts: Iterable of Tweet objects to persist

    Returns:
        Count of newly stored posts
    """
    stored_count = 0

    with get_session() as session:
        for post in posts:
            # Check if post already exists
            existing = session.execute(
                select(Tweet).where(Tweet.tweet_id == post.tweet_id)
            ).scalar_one_or_none()

            if not existing:
                session.add(post)
                stored_count += 1

        session.commit()

    return stored_count


def scrape_and_persist(keyword: str, limit: int | None = None, page_id: str | None = None) -> int:
    """Scrape Facebook posts and persist them in one step.

    Args:
        keyword: Search term
        limit: Maximum posts to fetch
        page_id: Optional Facebook page ID

    Returns:
        Number of posts stored
    """
    posts = scrape(keyword, limit=limit, page_id=page_id)
    return persist(posts)
