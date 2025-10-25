"""Entry point CLI for the sentiment analysis backend.

Supports both Twitter (original) and Reddit (alternative) as data sources.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict

from app import settings
from app.database import init_db
from app.pipeline import analyze_pending, scrape, scrape_and_analyze
# Reddit-specific imports (alternative source)
from app.pipeline import scrape_reddit, scrape_and_analyze_reddit
from app.summary import summarize_keyword


def _configure_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Multi-source sentiment analysis backend (Twitter + Reddit)")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # ============================================================================
    # TWITTER COMMANDS (Original)
    # ============================================================================
    scrape_parser = subparsers.add_parser("scrape", help="Scrape tweets for a keyword (Twitter)")
    scrape_parser.add_argument("keyword", type=str, help="Keyword or search query")
    scrape_parser.add_argument("--limit", type=int, default=settings.scrape_limit, help="Number of tweets to fetch")

    analyze_parser = subparsers.add_parser("analyze", help="Run sentiment analysis on stored tweets/posts")
    analyze_parser.add_argument("--limit", type=int, default=None, help="Limit the number of tweets to analyze")
    analyze_parser.add_argument("--json", action="store_true", help="Print the analyzed tweets as JSON")

    run_parser = subparsers.add_parser("run", help="Scrape and analyze in one step (Twitter)")
    run_parser.add_argument("keyword", type=str, help="Keyword or search query")
    run_parser.add_argument("--limit", type=int, default=settings.scrape_limit, help="Number of tweets to fetch")

    # ============================================================================
    # REDDIT COMMANDS (Alternative source)
    # ============================================================================
    scrape_reddit_parser = subparsers.add_parser("scrape-reddit", help="Scrape Reddit posts for a keyword")
    scrape_reddit_parser.add_argument("keyword", type=str, help="Keyword or search query")
    scrape_reddit_parser.add_argument("--limit", type=int, default=settings.scrape_limit, help="Number of posts to fetch")
    scrape_reddit_parser.add_argument("--subreddit", type=str, default="all", help="Subreddit to search (default: all)")

    run_reddit_parser = subparsers.add_parser("run-reddit", help="Scrape Reddit and analyze in one step")
    run_reddit_parser.add_argument("keyword", type=str, help="Keyword or search query")
    run_reddit_parser.add_argument("--limit", type=int, default=settings.scrape_limit, help="Number of posts to fetch")
    run_reddit_parser.add_argument("--subreddit", type=str, default="all", help="Subreddit to search (default: all)")

    return parser


def _fetch_analyzed(limit: int | None = None) -> list[Dict[str, Any]]:
    from sqlalchemy import select

    from app.database import get_session
    from app.models import Tweet

    with get_session() as session:
        stmt = select(Tweet).where(Tweet.sentiment.is_not(None)).order_by(Tweet.created_at.desc())
        if limit:
            stmt = stmt.limit(limit)
        rows = session.scalars(stmt).all()
        return [
            {
                "tweet_id": row.tweet_id,
                "keyword": row.keyword,
                "username": row.username,
                "content": row.content,
                "created_at": row.created_at.isoformat(),
                "sentiment": row.sentiment,
            }
            for row in rows
        ]


def main(argv: list[str] | None = None) -> int:
    init_db()
    parser = _configure_parser()
    args = parser.parse_args(argv)

    if args.command == "scrape":
        stored = scrape(args.keyword, limit=args.limit)
        print(f"Stored {stored} new tweets for '{args.keyword}'.")
        return 0

    if args.command == "analyze":
        updated = analyze_pending(limit=args.limit)
        print(f"Analyzed {updated} tweets.")
        if args.json:
            payload = _fetch_analyzed(limit=args.limit)
            print(json.dumps(payload, indent=2))
        return 0

    if args.command == "run":
        try:
            stored, analyzed = scrape_and_analyze(args.keyword, limit=args.limit)
        except RuntimeError as exc:
            stored = analyzed = 0
        summary, sample_size, _, _ = summarize_keyword(args.keyword, limit=args.limit)
        primary = summary["primary"]
        print(f"Stored {stored} tweets and analyzed {analyzed} tweets for '{args.keyword}'.")
        print(
            "Primary sentiment — "
            f"Positive: {primary['positive'] * 100:.1f}% | "
            f"Neutral: {primary['neutral'] * 100:.1f}% | "
            f"Negative: {primary['negative'] * 100:.1f}% | "
            f"Dominant label: {primary['label']} (confidence {primary['confidence'] * 100:.1f}%)"
        )
        print(f"Summary calculated from {sample_size} tweets with stored sentiment scores.")
        return 0

    # ============================================================================
    # REDDIT COMMAND HANDLERS (Alternative source)
    # ============================================================================
    if args.command == "scrape-reddit":
        stored = scrape_reddit(args.keyword, limit=args.limit, subreddit=args.subreddit)
        print(f"Stored {stored} new Reddit posts for '{args.keyword}' from r/{args.subreddit}.")
        return 0

    if args.command == "run-reddit":
        stored, analyzed = scrape_and_analyze_reddit(args.keyword, limit=args.limit, subreddit=args.subreddit)
        print(f"Stored {stored} Reddit posts and analyzed {analyzed} posts for '{args.keyword}' from r/{args.subreddit}.")
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
