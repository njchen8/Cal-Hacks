"""Database models."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Tweet(Base):
    """Persisted user-generated content record."""

    __tablename__ = "tweets"
    __table_args__ = (
        Index("ix_tweets_keyword_created_at", "keyword", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tweet_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    keyword: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    like_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reply_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    retweet_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quote_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    sentiment: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"Tweet(tweet_id={self.tweet_id!r}, keyword={self.keyword!r})"
