"""FastAPI application exposing sentiment analysis endpoints."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Iterable, Literal, Optional, Tuple
import contextlib
import io
import json
import os
import subprocess
import sys

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .config import settings
from .database import init_db
from .summary import summarize_keyword
from generate_report import generate_report_by_keyword, sanitize_filename
from lava_summary import GeminiSummarizer

app = FastAPI(title="Sentiment Event API", version="1.0.0")

BACKEND_ROOT = Path(__file__).resolve().parent.parent


PipelineSource = Literal["twitter", "reddit"]


def _capture_stdout(func, collector: list[str], *args, **kwargs):
    buffer = io.StringIO()
    with contextlib.redirect_stdout(buffer):
        result = func(*args, **kwargs)
    captured = buffer.getvalue().strip()
    if captured:
        collector.extend(captured.splitlines())
    return result


def _ensure_csv_report(
    keyword: str,
    force_refresh: bool,
    existing_path: Optional[Path] = None,
) -> tuple[Optional[Path], list[str]]:
    log_lines: list[str] = []
    safe_kw = sanitize_filename(keyword)
    reports_dir = settings.base_dir / "reports"
    csv_path = existing_path or reports_dir / f"sentiment_{safe_kw}.csv"

    preexisting = csv_path.exists()
    generated = False

    if force_refresh or not preexisting:
        csv_files = _capture_stdout(generate_report_by_keyword, log_lines, keyword)
        if csv_files:
            csv_path = csv_files[0]
            generated = True

    if csv_path.exists():
        if generated or not preexisting:
            log_lines.append(f"[csv] Export ready at {csv_path}")
        else:
            log_lines.append(f"[csv] Using cached export at {csv_path}")
        return csv_path, log_lines

    csv_files = _capture_stdout(generate_report_by_keyword, log_lines, keyword)
    if csv_files:
        csv_path = csv_files[0]
        if csv_path.exists():
            log_lines.append(f"[csv] Export ready at {csv_path}")
            return csv_path, log_lines

    log_lines.append("[csv] Failed to generate sentiment CSV (no analyzed posts).")
    return None, log_lines


def _cli_command(
    keyword: str,
    limit: Optional[int],
    engine: str,
    source: PipelineSource,
    ignore_cache: bool = False,
) -> list[str]:
    command = [
        sys.executable,
        "-u",
        str(BACKEND_ROOT / "main.py"),
    ]
    if source == "twitter":
        command.append("run")
    else:
        command.append("run-reddit")

    command.append(keyword)
    if limit:
        command.extend(["--limit", str(limit)])
    if engine != "default":
        command.extend(["--engine", engine])
    if ignore_cache and source == "twitter":
        command.append("--ignore-cache")
    return command


def _run_cli(
    keyword: str,
    limit: Optional[int],
    engine: str,
    sources: Iterable[PipelineSource],
    ignore_cache: bool = False,
) -> str:
    outputs: list[str] = []
    for source in sources:
        result = subprocess.run(
            _cli_command(keyword, limit, engine, source, ignore_cache=ignore_cache),
            cwd=str(BACKEND_ROOT),
            capture_output=True,
            text=True,
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
        )

        if result.returncode != 0:
            detail = result.stderr.strip() or "Backend command failed."
            raise HTTPException(status_code=500, detail=detail)

        stdout = result.stdout.strip()
        if stdout:
            outputs.append(stdout)

    return "\n".join(outputs)


def _cli_output_lines(
    keyword: str,
    limit: Optional[int],
    engine: str,
    source: PipelineSource,
    ignore_cache: bool = False,
):
    process = subprocess.Popen(
        _cli_command(keyword, limit, engine, source, ignore_cache=ignore_cache),
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


def _gemini_env_ready() -> bool:
    return bool(settings.gemini_api_key)


def _generate_gemini_summary(
    keyword: str,
    force_refresh: bool,
    existing_csv: Optional[Path] = None,
) -> Tuple[Optional[str], Optional[Path], Optional[Path], list[str]]:
    safe_kw = sanitize_filename(keyword)
    reports_dir = settings.base_dir / "reports"
    summary_path = reports_dir / f"summary_{safe_kw}.txt"
    csv_path = existing_csv or reports_dir / f"sentiment_{safe_kw}.csv"

    log_lines: list[str] = []
    if existing_csv is not None and existing_csv.exists():
        csv_path = existing_csv
    else:
        csv_path, csv_logs = _ensure_csv_report(keyword, force_refresh, csv_path)
        log_lines.extend(csv_logs)
        if csv_path is None:
            return None, None, None, log_lines

    if not _gemini_env_ready():
        log_lines.append("[gemini] Skipping summary generation (Gemini credentials not configured).")
        return None, None, csv_path, log_lines

    if not force_refresh and summary_path.exists():
        try:
            if csv_path.exists() and summary_path.stat().st_mtime >= csv_path.stat().st_mtime:
                log_lines.append(f"[gemini] Reusing existing summary at {summary_path}")
                summary_text = summary_path.read_text(encoding="utf-8").strip()
                return summary_text, summary_path, csv_path, log_lines
        except OSError:
            pass

    try:
        summarizer = GeminiSummarizer(api_key=settings.gemini_api_key)
    except ValueError:
        log_lines.append("[gemini] Gemini API key is missing; summary skipped.")
        return None, None, csv_path, log_lines

    summary_text = _capture_stdout(summarizer.generate_summary, log_lines, str(csv_path), summary_path)
    if summary_text is None:
        return None, None, csv_path, log_lines

    return summary_text.strip(), summary_path, csv_path, log_lines


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
        cli_output = _run_cli(
            keyword,
            payload.limit,
            payload.engine,
            ("twitter", "reddit"),
            ignore_cache=True,
        )

    _, sample_size, total_content, latest_content_at = summarize_keyword(keyword, limit=payload.limit)

    if total_content == 0:
        cli_output = _run_cli(
            keyword,
            payload.limit,
            payload.engine,
            ("twitter", "reddit"),
            ignore_cache=True,
        )
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
        ignore_cache = payload.refresh or total_content == 0
        if needs_refresh:
            yield _encode_event({"type": "log", "message": "Refreshing dataset via backend CLI..."})
            try:
                for source in ("twitter", "reddit"):
                    label = "Twitter" if source == "twitter" else "Reddit"
                    yield _encode_event({"type": "log", "message": f"Running {label} pipeline..."})
                    try:
                        for line in _cli_output_lines(
                            keyword,
                            payload.limit,
                            payload.engine,
                            source,
                            ignore_cache=ignore_cache,
                        ):
                            if not line:
                                continue
                            yield _encode_event({"type": "log", "message": line})
                    except RuntimeError as exc:
                        yield _encode_event(
                            {
                                "type": "log",
                                "message": f"[{label.lower()}] pipeline failed: {exc}",
                            }
                        )
                        continue
                    yield _encode_event({"type": "log", "message": f"{label} pipeline finished."})
            except RuntimeError as exc:
                yield _encode_event({"type": "error", "message": str(exc)})
                return

            _, sample_size, total_content, latest_content_at = summarize_keyword(keyword, limit=payload.limit)

        csv_path: Optional[Path] = None
        if total_content > 0 or needs_refresh:
            yield _encode_event({"type": "log", "message": "Generating combined sentiment CSV..."})
            csv_path, csv_logs = _ensure_csv_report(keyword, needs_refresh)
            for entry in csv_logs:
                yield _encode_event({"type": "log", "message": entry})

        gemini_summary_text: Optional[str] = None
        gemini_summary_path: Optional[Path] = None
        if csv_path and _gemini_env_ready():
            yield _encode_event({"type": "log", "message": "Preparing Gemini summary..."})
            try:
                gemini_summary_text, summary_path, _, gemini_logs = _generate_gemini_summary(
                    keyword,
                    needs_refresh,
                    csv_path,
                )
                for entry in gemini_logs:
                    yield _encode_event({"type": "log", "message": entry})
                if summary_path:
                    gemini_summary_path = summary_path
                    yield _encode_event(
                        {
                            "type": "log",
                            "message": f"[gemini] Summary saved to: {summary_path}",
                        }
                    )
            except RuntimeError as exc:
                yield _encode_event({"type": "log", "message": f"Gemini summary failed: {exc}"})
            except Exception as exc:  # pragma: no cover - protective catch for unexpected errors
                yield _encode_event({"type": "log", "message": f"Gemini summary failed: {exc}"})
        elif csv_path:
            yield _encode_event(
                {
                    "type": "log",
                    "message": "[gemini] Skipping summary generation (Gemini credentials not configured).",
                }
            )

        if gemini_summary_text:
            summary_message: dict[str, object] = {"text": gemini_summary_text, "keyword": keyword}
            if csv_path:
                summary_message["csvPath"] = str(csv_path)
            if gemini_summary_path:
                summary_message["summaryPath"] = str(gemini_summary_path)
            yield _encode_event({"type": "gemini", "message": summary_message})

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