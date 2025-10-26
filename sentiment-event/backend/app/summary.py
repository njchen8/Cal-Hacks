"""Utilities for aggregating sentiment results across user-generated content."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from typing import DefaultDict, Dict, Iterable, Optional, Tuple

from sqlalchemy import func, select

from .config import settings
from .database import get_session
from .models import Tweet


def _empty_summary() -> Dict[str, Dict[str, Dict[str, float]]]:
    return {
        "primary": {
            "positive": 0.0,
            "negative": 0.0,
            "neutral": 0.0,
            "label": "neutral",
            "confidence": 0.0,
        },
        "signals": {"positive": {}, "negative": {}, "neutral": {}},
    }


def aggregate_sentiments(sentiments: Iterable[Dict[str, Dict]]) -> Tuple[Dict, int]:
    """Aggregate individual content sentiment payloads into a single summary."""

    totals = {"positive": 0.0, "negative": 0.0, "neutral": 0.0, "confidence": 0.0}
    label_counter: Counter[str] = Counter()
    signal_totals: Dict[str, DefaultDict[str, float]] = {
        "positive": defaultdict(float),
        "negative": defaultdict(float),
        "neutral": defaultdict(float),
    }
    signal_counts: Dict[str, DefaultDict[str, int]] = {
        "positive": defaultdict(int),
        "negative": defaultdict(int),
        "neutral": defaultdict(int),
    }

    count = 0

    for entry in sentiments:
        if not isinstance(entry, dict):
            continue

        primary = entry.get("primary") or {}
        signals = entry.get("signals") or {}

        valid = False
        for key in ("positive", "negative", "neutral", "confidence"):
            value = primary.get(key)
            if isinstance(value, (int, float)):
                totals[key] += float(value)
                valid = True

        if not valid:
            continue

        count += 1

        label = primary.get("label")
        if isinstance(label, str):
            label_counter[label.lower()] += 1

        for polarity, labels in signals.items():
            if polarity not in signal_totals or not isinstance(labels, dict):
                continue
            for signal_label, score in labels.items():
                if isinstance(score, (int, float)):
                    signal_totals[polarity][signal_label] += float(score)
                    signal_counts[polarity][signal_label] += 1

    if count == 0:
        return _empty_summary(), 0

    summary = _empty_summary()
    for key in ("positive", "negative", "neutral", "confidence"):
        summary["primary"][key] = totals[key] / count

    if label_counter:
        summary["primary"]["label"] = label_counter.most_common(1)[0][0]
    else:
        dominant = max(("positive", "neutral", "negative"), key=lambda k: summary["primary"].get(k, 0.0))
        summary["primary"]["label"] = dominant

    for polarity, labels in signal_totals.items():
        bucket = summary["signals"][polarity]
        for signal_label, total_score in labels.items():
            occurrences = signal_counts[polarity][signal_label]
            if occurrences == 0:
                continue
            average = total_score / occurrences
            if average >= settings.min_probability:
                bucket[signal_label] = average

    return summary, count


def summarize_keyword(keyword: str, limit: Optional[int] = None) -> Tuple[Dict, int, int, Optional[datetime]]:
    """Return aggregated sentiment data for content associated with a keyword."""

    keyword = keyword.strip()
    if not keyword:
        return _empty_summary(), 0, 0, None

    with get_session() as session:
        base_query = select(Tweet).where(Tweet.keyword == keyword, Tweet.sentiment.is_not(None)).order_by(
            Tweet.created_at.desc()
        )
        if limit:
            base_query = base_query.limit(limit)
        rows = session.scalars(base_query).all()

        total_count = session.scalar(
            select(func.count()).select_from(Tweet).where(Tweet.keyword == keyword, Tweet.sentiment.is_not(None))
        )

    sentiments = [tweet.sentiment for tweet in rows if tweet.sentiment]
    summary, sample_size = aggregate_sentiments(sentiments)
    latest_timestamp = rows[0].created_at if rows else None

    return summary, sample_size, int(total_count or 0), latest_timestamp