"""Entry point CLI for the sentiment analysis backend."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict

from app import settings
from app.database import init_db
from app.pipeline import analyze_pending, scrape, scrape_and_analyze


def _configure_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Twitter sentiment analysis backend")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scrape_parser = subparsers.add_parser("scrape", help="Scrape tweets for a keyword")
    scrape_parser.add_argument("keyword", type=str, help="Keyword or search query")
    scrape_parser.add_argument("--limit", type=int, default=settings.scrape_limit, help="Number of tweets to fetch")

    analyze_parser = subparsers.add_parser("analyze", help="Run sentiment analysis on stored tweets")
    analyze_parser.add_argument("--limit", type=int, default=None, help="Limit the number of tweets to analyze")
    analyze_parser.add_argument("--json", action="store_true", help="Print the analyzed tweets as JSON")

    run_parser = subparsers.add_parser("run", help="Scrape and analyze in one step")
    run_parser.add_argument("keyword", type=str, help="Keyword or search query")
    run_parser.add_argument("--limit", type=int, default=settings.scrape_limit, help="Number of tweets to fetch")

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
        stored, analyzed = scrape_and_analyze(args.keyword, limit=args.limit)
        print(f"Stored {stored} tweets and analyzed {analyzed} tweets for '{args.keyword}'.")
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
