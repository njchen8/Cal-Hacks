"""Application configuration utilities."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv


def _load_environment() -> None:
    """Load environment variables from .env files, if present."""

    project_root = Path(__file__).resolve().parents[2]
    candidate_paths = (
        project_root / ".env",
        project_root / "backend" / ".env",
    )

    for env_path in candidate_paths:
        if env_path.exists():
            load_dotenv(env_path, override=False)


_load_environment()


@dataclass(frozen=True)
class Settings:
    """Container for runtime configuration."""

    base_dir: Path = Path(__file__).resolve().parent.parent
    data_dir: Path = base_dir / "data"
    database_url: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{(base_dir / 'data' / 'tweets.db').as_posix()}",
    )
    default_keyword: str = os.getenv("SCRAPE_KEYWORD", "")
    scrape_limit: int = int(os.getenv("SCRAPE_LIMIT", "100"))
    min_probability: float = float(os.getenv("MIN_PROBABILITY", "0.05"))

    # Twitter API credentials (original implementation)
    twitter_bearer_token: Optional[str] = os.getenv("TWITTER_BEARER_TOKEN")
    twitter_app_user_agent: str = os.getenv(
        "TWITTER_APP_USER_AGENT",
        "SentimentEventBackend/1.0",
    )

    # Reddit API credentials (alternative source)
    reddit_client_id: Optional[str] = os.getenv("REDDIT_CLIENT_ID")
    reddit_client_secret: Optional[str] = os.getenv("REDDIT_CLIENT_SECRET")
    reddit_user_agent: str = os.getenv(
        "REDDIT_USER_AGENT",
        "SentimentEventBackend/1.0 (by /u/YourUsername)",
    )

    @property
    def sqlite_path(self) -> Path:
        """Return the sqlite file path when using the local sqlite URL."""
        if self.database_url.startswith("sqlite:///"):
            return Path(self.database_url.replace("sqlite:///", ""))
        raise ValueError("DATABASE_URL does not reference a local sqlite file")


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
