"""FastAPI application exposing sentiment analysis endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .database import init_db
from .pipeline import scrape_and_analyze
from .summary import summarize_keyword

app = FastAPI(title="Sentiment Event API", version="1.0.0")


class SentimentPrimaryModel(BaseModel):
    positive: float
    negative: float
    neutral: float
    label: str
    confidence: float


class SentimentSignalsModel(BaseModel):
    positive: Dict[str, float]
    negative: Dict[str, float]
    neutral: Dict[str, float]


class SentimentMetaModel(BaseModel):
    keyword: str
    sampleSize: int = Field(..., ge=0)
    totalTweets: int = Field(..., ge=0)
    newlyScraped: int = Field(..., ge=0)
    newlyAnalyzed: int = Field(..., ge=0)
    latestTweetAt: Optional[datetime] = None


class AnalyzeResponseModel(BaseModel):
    primary: SentimentPrimaryModel
    signals: SentimentSignalsModel
    meta: SentimentMetaModel


class AnalyzeRequestModel(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=280)
    limit: Optional[int] = Field(None, ge=1, le=500)
    refresh: bool = True


@app.on_event("startup")
def _on_startup() -> None:
    init_db()


@app.post("/analyze", response_model=AnalyzeResponseModel)
def analyze_keyword(payload: AnalyzeRequestModel) -> AnalyzeResponseModel:
    keyword = payload.keyword.strip()
    if not keyword:
        raise HTTPException(status_code=400, detail="Keyword must not be empty.")

    stored = analyzed = 0
    if payload.refresh:
        stored, analyzed = scrape_and_analyze(keyword, limit=payload.limit)

    summary, sample_size, total_tweets, latest_tweet_at = summarize_keyword(keyword, limit=payload.limit)

    return AnalyzeResponseModel(
        primary=SentimentPrimaryModel(**summary["primary"]),
        signals=SentimentSignalsModel(**summary["signals"]),
        meta=SentimentMetaModel(
            keyword=keyword,
            sampleSize=sample_size,
            totalTweets=total_tweets,
            newlyScraped=stored,
            newlyAnalyzed=analyzed,
            latestTweetAt=latest_tweet_at,
        ),
    )


@app.get("/healthz")
def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}