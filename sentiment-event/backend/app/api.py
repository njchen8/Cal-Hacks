"""FastAPI application exposing sentiment analysis endpoints."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional
import subprocess
import sys

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .database import init_db
from .summary import summarize_keyword

app = FastAPI(title="Sentiment Event API", version="1.0.0")

BACKEND_ROOT = Path(__file__).resolve().parent.parent


class AnalyzeResponseModel(BaseModel):
    keyword: str
    storedTweets: int = Field(..., ge=0)
    sampleSize: int = Field(..., ge=0)
    latestTweetAt: Optional[datetime] = None
    message: str


class AnalyzeRequestModel(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=280)
    limit: Optional[int] = Field(None, ge=1, le=500)
    refresh: bool = False


@app.on_event("startup")
def _on_startup() -> None:
    init_db()


@app.post("/analyze", response_model=AnalyzeResponseModel)
def analyze_keyword(payload: AnalyzeRequestModel) -> AnalyzeResponseModel:
    keyword = payload.keyword.strip()
    if not keyword:
        raise HTTPException(status_code=400, detail="Keyword must not be empty.")

    cli_output = ""
    if payload.refresh:
        command = [
            sys.executable,
            str(BACKEND_ROOT / "main.py"),
            "run",
            keyword,
        ]
        if payload.limit:
            command.extend(["--limit", str(payload.limit)])

        result = subprocess.run(
            command,
            cwd=str(BACKEND_ROOT),
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            detail = result.stderr.strip() or "Backend command failed."
            raise HTTPException(status_code=500, detail=detail)

        cli_output = result.stdout.strip()

    _, sample_size, total_tweets, latest_tweet_at = summarize_keyword(keyword, limit=payload.limit)

    message = cli_output or f"{total_tweets} tweets currently stored for '{keyword}'."

    return AnalyzeResponseModel(
        keyword=keyword,
        storedTweets=total_tweets,
        sampleSize=sample_size,
        latestTweetAt=latest_tweet_at,
        message=message,
    )


@app.get("/healthz")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}