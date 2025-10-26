"""FastAPI application exposing sentiment analysis endpoints."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Literal, Optional
import json
import os
import subprocess
import sys

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .database import init_db
from .summary import summarize_keyword

app = FastAPI(title="Sentiment Event API", version="1.0.0")

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _cli_command(keyword: str, limit: Optional[int], engine: str) -> list[str]:
    command = [
        sys.executable,
        "-u",
        str(BACKEND_ROOT / "main.py"),
        "run-reddit",
        keyword,
    ]
    if limit:
        command.extend(["--limit", str(limit)])
    if engine != "default":
        command.extend(["--engine", engine])
    return command


def _run_cli(keyword: str, limit: Optional[int], engine: str) -> str:
    result = subprocess.run(
        _cli_command(keyword, limit, engine),
        cwd=str(BACKEND_ROOT),
        capture_output=True,
        text=True,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )

    if result.returncode != 0:
        detail = result.stderr.strip() or "Backend command failed."
        raise HTTPException(status_code=500, detail=detail)

    return result.stdout.strip()


def _cli_output_lines(keyword: str, limit: Optional[int], engine: str):
    process = subprocess.Popen(
        _cli_command(keyword, limit, engine),
        cwd=str(BACKEND_ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )

    assert process.stdout is not None

    try:
        for line in process.stdout:
            yield line.rstrip()
    finally:
        process.stdout.close()

    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(f"Backend command failed with exit code {return_code}.")


def _encode_event(payload: dict) -> bytes:
    return (json.dumps(payload) + "\n").encode("utf-8")


class AnalyzeResponseModel(BaseModel):
    keyword: str
    storedContent: int = Field(..., ge=0)
    sampleSize: int = Field(..., ge=0)
    latestContentAt: Optional[datetime] = None
    message: str


class AnalyzeRequestModel(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=280)
    limit: Optional[int] = Field(None, ge=1, le=500)
    refresh: bool = False
    engine: Literal["default", "fast"] = "default"


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
        cli_output = _run_cli(keyword, payload.limit, payload.engine)

    _, sample_size, total_content, latest_content_at = summarize_keyword(keyword, limit=payload.limit)

    if total_content == 0:
        cli_output = _run_cli(keyword, payload.limit, payload.engine)
        _, sample_size, total_content, latest_content_at = summarize_keyword(keyword, limit=payload.limit)

    message = cli_output or f"{total_content} content entries currently stored for '{keyword}'."

    return AnalyzeResponseModel(
        keyword=keyword,
        storedContent=total_content,
        sampleSize=sample_size,
        latestContentAt=latest_content_at,
        message=message,
    )


@app.post("/analyze/stream")
def analyze_keyword_stream(payload: AnalyzeRequestModel):
    keyword = payload.keyword.strip()
    if not keyword:
        raise HTTPException(status_code=400, detail="Keyword must not be empty.")

    def event_stream():
        yield _encode_event({"type": "log", "message": f"Checking stored data for '{keyword}'..."})
        _, sample_size, total_content, latest_content_at = summarize_keyword(keyword, limit=payload.limit)

        needs_refresh = payload.refresh or total_content == 0
        if needs_refresh:
            yield _encode_event({"type": "log", "message": "Refreshing dataset via backend CLI..."})
            try:
                for line in _cli_output_lines(keyword, payload.limit, payload.engine):
                    if not line:
                        continue
                    yield _encode_event({"type": "log", "message": line})
            except RuntimeError as exc:
                yield _encode_event({"type": "error", "message": str(exc)})
                return

            _, sample_size, total_content, latest_content_at = summarize_keyword(keyword, limit=payload.limit)

        yield _encode_event(
            {
                "type": "summary",
                "payload": {
                    "keyword": keyword,
                    "storedContent": total_content,
                    "sampleSize": sample_size,
                    "latestContentAt": latest_content_at.isoformat() if latest_content_at else None,
                    "message": f"{total_content} content entries currently stored for '{keyword}'.",
                },
            }
        )

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@app.get("/healthz")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}