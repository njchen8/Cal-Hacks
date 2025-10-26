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
            load_dotenv(env_path, override=True)


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
    scrape_limit: int = int(os.getenv("SCRAPE_LIMIT", "180"))
    min_probability: float = float(os.getenv("MIN_PROBABILITY", "0.05"))
    sentiment_batch_size: int = max(1, int(os.getenv("SENTIMENT_BATCH_SIZE", "8")))

    # Twitter API credentials (Twikit manual scraper - main implementation)
    twitter_cookie_header: Optional[str] = os.getenv("TWITTER_COOKIE_HEADER")
    twitter_cookie_file: Optional[str] = os.getenv("TWITTER_COOKIE_FILE")
    twitter_username: Optional[str] = os.getenv("TWITTER_USERNAME")
    twitter_password: Optional[str] = os.getenv("TWITTER_PASSWORD")
    twitter_user_agent: str = os.getenv(
        "TWITTER_USER_AGENT",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    )
    model_cache_dir: Path = data_dir / "model_cache"

    # Twitter API credentials (legacy bearer token - kept for compatibility)
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

    # Lava Gateway API credentials (for LLM-powered sentiment summaries)
    lava_api_key: Optional[str] = os.getenv("LAVA_API_KEY")
    lava_base_url: str = os.getenv("LAVA_BASE_URL", "https://api.lavagateway.com/v1")

    # Facebook API credentials (alternative source)
    facebook_access_token: Optional[str] = os.getenv("FACEBOOK_ACCESS_TOKEN")
    facebook_app_id: Optional[str] = os.getenv("FACEBOOK_APP_ID")
    facebook_app_secret: Optional[str] = os.getenv("FACEBOOK_APP_SECRET")

    @property
    def sqlite_path(self) -> Path:
        """Return the sqlite file path when using the local sqlite URL."""
        if self.database_url.startswith("sqlite:///"):
            return Path(self.database_url.replace("sqlite:///", ""))
        raise ValueError("DATABASE_URL does not reference a local sqlite file")

    @property
    def resolved_cookie_path(self) -> Path:
        """Return the path where twitter cookies should be stored."""
        if self.twitter_cookie_file:
            return Path(self.twitter_cookie_file).expanduser().resolve()
        return self.data_dir / "twitter_cookies.json"


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
settings.model_cache_dir.mkdir(parents=True, exist_ok=True)
