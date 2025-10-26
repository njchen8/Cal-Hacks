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
from app.pipeline import analyze_pending, scrape, scrape_reddit
from app.scraper import update_export_with_sentiment
from app.summary import summarize_keyword

ANALYZER_CHOICES = ("default", "fast")


def _configure_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Multi-source sentiment analysis backend (Twitter + Reddit)")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scrape_parser = subparsers.add_parser("scrape", help="Scrape user content for a keyword")
    scrape_parser.add_argument("keyword", type=str, help="Keyword or search query")
    scrape_parser.add_argument("--limit", type=int, default=settings.scrape_limit, help="Number of items to fetch")
    scrape_parser.add_argument(
        "--ignore-cache",
        action="store_true",
        help="Bypass the cached export window and force a fresh scrape",
    )

    analyze_parser = subparsers.add_parser("analyze", help="Run sentiment analysis on stored content")
    analyze_parser.add_argument("--limit", type=int, default=None, help="Limit the number of items to analyze")
    analyze_parser.add_argument("--json", action="store_true", help="Print the analyzed content as JSON")
    analyze_parser.add_argument(
        "--engine",
        choices=ANALYZER_CHOICES,
        default="default",
        help="Select sentiment analyzer variant (default or fast).",
    )

    run_parser = subparsers.add_parser("run", help="Scrape and analyze in one step (Twitter)")
    run_parser.add_argument("keyword", type=str, help="Keyword or search query")
    run_parser.add_argument("--limit", type=int, default=settings.scrape_limit, help="Number of items to fetch")
    run_parser.add_argument(
        "--ignore-cache",
        action="store_true",
        help="Bypass the cached export window and force a fresh scrape",
    )
    run_parser.add_argument(
        "--engine",
        choices=ANALYZER_CHOICES,
        default="default",
        help="Select sentiment analyzer variant (default or fast).",
    )

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
    run_reddit_parser.add_argument(
        "--engine",
        choices=ANALYZER_CHOICES,
        default="default",
        help="Select sentiment analyzer variant (default or fast).",
    )

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
        result = scrape(args.keyword, limit=args.limit, ignore_cache=args.ignore_cache)
        print(result.message)
        return 0

    if args.command == "analyze":
        updated = analyze_pending(limit=args.limit, variant=args.engine)
        print(f"Analyzed {updated} content entries.")
        if args.json:
            payload = _fetch_analyzed(limit=args.limit)
            print(json.dumps(payload, indent=2))
        return 0

    if args.command == "run":
        print(f"[1/5] Starting refresh for '{args.keyword}'.", flush=True)
        scrape_result = None
        try:
            print("[2/5] Checking cached exports and scraping if required...", flush=True)
            scrape_result = scrape(args.keyword, limit=args.limit, ignore_cache=args.ignore_cache)
            print(f"[3/5] {scrape_result.message}", flush=True)

            if scrape_result.used_cache:
                analyzed = 0
                print("[4/5] Skipping sentiment analysis; using cached results.", flush=True)
            else:
                print(
                    "[4/5] Preparing sentiment analyzer (first run may take a minute)...",
                    flush=True,
                )
                progress_state = {"last": -1, "announced_start": False}

                def _analyzer_ready(total: int) -> None:
                    if total <= 0:
                        return
                    print(
                        f"[4/5] Sentiment analyzer ready. Processing {total} item(s)...",
                        flush=True,
                    )

                def _progress_callback(done: int, total: int) -> None:
                    if total == 0:
                        if progress_state["last"] != 0:
                            print("[4/5] No content pending sentiment analysis.", flush=True)
                            progress_state["last"] = 0
                        return

                    if not progress_state["announced_start"]:
                        print(
                            f"[4/5] Running sentiment analysis on pending content ({total} item(s))...",
                            flush=True,
                        )
                        progress_state["announced_start"] = True

                    segments = 20
                    step = max(1, total // segments)
                    if done == total or done == 0 or done % step == 0:
                        if done != progress_state["last"]:
                            ratio = done / total if total else 0
                            filled = int(round(ratio * segments))
                            filled = max(0, min(segments, filled))
                            bar = "#" * filled + "-" * (segments - filled)
                            print(
                                f"[4/5] Sentiment analysis progress: [{bar}] {done}/{total}",
                                flush=True,
                            )
                            progress_state["last"] = done

                analyzed = analyze_pending(
                    keyword=args.keyword,
                    progress_callback=_progress_callback,
                    variant=args.engine,
                    on_ready=_analyzer_ready,
                )

                if progress_state["last"] != analyzed and analyzed > 0:
                    _progress_callback(analyzed, analyzed)

                print(f"[4/5] Analysis complete. Updated {analyzed} content entries.", flush=True)
        except RuntimeError as exc:
            print(f"[!] Pipeline error: {exc}", flush=True)

        if scrape_result and scrape_result.export_path:
            update_export_with_sentiment(scrape_result.export_path)

        _, sample_size, total_content, latest = summarize_keyword(args.keyword, limit=args.limit)
        if latest:
            print(f"[5/5] Latest content entry recorded at {latest.isoformat()}.", flush=True)
        print(f"{total_content} content entries currently stored for '{args.keyword}'.", flush=True)
        print(f"Most recent summary used {sample_size} content entries that already have sentiment scores.", flush=True)
        return 0

    # ============================================================================
    # REDDIT COMMAND HANDLERS (Alternative source)
    # ============================================================================
    if args.command == "scrape-reddit":
        stored = scrape_reddit(args.keyword, limit=args.limit, subreddit=args.subreddit)
        print(f"Stored {stored} new Reddit posts for '{args.keyword}' from r/{args.subreddit}.")
        return 0

    if args.command == "run-reddit":
        print(f"[1/5] Starting Reddit refresh for '{args.keyword}'.", flush=True)
        stored = 0
        analyzed = 0
        try:
            print("[2/5] Scraping Reddit posts via API...", flush=True)
            stored = scrape_reddit(args.keyword, limit=args.limit, subreddit=args.subreddit)
            print(
                f"[3/5] Stored {stored} new Reddit posts for '{args.keyword}' from r/{args.subreddit}.",
                flush=True,
            )

            print(
                "[4/5] Preparing sentiment analyzer (first run may take a minute)...",
                flush=True,
            )
            progress_state = {"last": -1, "announced_start": False}

            def _analyzer_ready(total: int) -> None:
                if total <= 0:
                    return
                print(
                    f"[4/5] Sentiment analyzer ready. Processing {total} Reddit item(s)...",
                    flush=True,
                )

            def _progress_callback(done: int, total: int) -> None:
                if total == 0:
                    if progress_state["last"] != 0:
                        print("[4/5] No content pending sentiment analysis.", flush=True)
                        progress_state["last"] = 0
                    return

                if not progress_state["announced_start"]:
                    print(
                        f"[4/5] Running sentiment analysis on pending Reddit content ({total} item(s))...",
                        flush=True,
                    )
                    progress_state["announced_start"] = True

                segments = 20
                step = max(1, total // segments)
                if done == total or done == 0 or done % step == 0:
                    if done != progress_state["last"]:
                        ratio = done / total if total else 0
                        filled = int(round(ratio * segments))
                        filled = max(0, min(segments, filled))
                        bar = "#" * filled + "-" * (segments - filled)
                        print(
                            f"[4/5] Sentiment analysis progress: [{bar}] {done}/{total}",
                            flush=True,
                        )
                        progress_state["last"] = done

            analyzed = analyze_pending(
                keyword=args.keyword,
                progress_callback=_progress_callback,
                variant=args.engine,
                on_ready=_analyzer_ready,
            )

            if progress_state["last"] != analyzed and analyzed > 0:
                _progress_callback(analyzed, analyzed)

            print(f"[4/5] Analysis complete. Updated {analyzed} content entries.", flush=True)
        except RuntimeError as exc:
            print(f"[!] Reddit pipeline error: {exc}", flush=True)

        _, sample_size, total_content, latest = summarize_keyword(args.keyword, limit=args.limit)
        if latest:
            print(f"[5/5] Latest content entry recorded at {latest.isoformat()}.", flush=True)
        print(f"{total_content} content entries currently stored for '{args.keyword}'.", flush=True)
        print(
            f"Most recent summary used {sample_size} content entries that already have sentiment scores.",
            flush=True,
        )
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
