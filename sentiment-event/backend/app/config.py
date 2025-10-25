"""Application configuration utilities."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True)
class Settings:
    """Container for runtime configuration."""

    base_dir: Path = Path(__file__).resolve().parent.parent
    data_dir: Path = base_dir / "data"
    database_url: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{(base_dir / 'data' / 'tweets.db').as_posix()}",
    )
    default_keyword: str = os.getenv("SCRAPE_KEYWORD", "cal hacks")
    scrape_limit: int = int(os.getenv("SCRAPE_LIMIT", "100"))
    min_probability: float = float(os.getenv("MIN_PROBABILITY", "0.05"))

    @property
    def sqlite_path(self) -> Path:
        """Return the sqlite file path when using the local sqlite URL."""
        if self.database_url.startswith("sqlite:///"):
            return Path(self.database_url.replace("sqlite:///", ""))
        raise ValueError("DATABASE_URL does not reference a local sqlite file")


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
