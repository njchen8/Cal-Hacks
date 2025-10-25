"""Sentiment and emotion analysis utilities."""

from __future__ import annotations

from functools import lru_cache
from typing import Dict

from transformers import pipeline

from .config import settings

PRIMARY_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
EMOTION_MODEL = "facebook/bart-large-mnli"
EMOTION_LABELS = [
    "fear",
    "desire",
    "greed",
    "joy",
    "anger",
    "trust",
    "anticipation",
    "surprise",
]
SIGNAL_POLARITY = {
    "fear": "negative",
    "anger": "negative",
    "greed": "negative",
    "surprise": "neutral",
    "desire": "positive",
    "joy": "positive",
    "trust": "positive",
    "anticipation": "positive",
}


class SentimentAnalyzer:
    """Wrapper around transformer pipelines for tweet analysis."""

    def __init__(self) -> None:
        self._sentiment_pipeline = pipeline(
            task="sentiment-analysis",
            model=PRIMARY_MODEL,
            tokenizer=PRIMARY_MODEL,
            cache_dir=str(settings.model_cache_dir),
        )
        self._emotion_pipeline = pipeline(
            task="zero-shot-classification",
            model=EMOTION_MODEL,
            multi_label=True,
            cache_dir=str(settings.model_cache_dir),
        )

    def analyze(self, text: str) -> Dict[str, Dict[str, float]]:
        """Return positive/negative probabilities with granular signals."""
        text = text.strip()
        if not text:
            return {
                "primary": {"positive": 0.0, "negative": 0.0, "neutral": 1.0, "label": "neutral", "confidence": 1.0},
                "signals": {"positive": {}, "negative": {}, "neutral": {}},
            }

        sentiment_scores = self._sentiment_pipeline(text, return_all_scores=True)[0]
        built = {score["label"].lower(): score["score"] for score in sentiment_scores}
        positive = float(built.get("positive", 0.0))
        negative = float(built.get("negative", 0.0))
        neutral = float(built.get("neutral", 0.0))

        candidates = {"positive": positive, "negative": negative, "neutral": neutral}
        top_label = max(candidates, key=candidates.get)
        top_score = candidates[top_label]

        emotion_result = self._emotion_pipeline(
            sequences=text,
            candidate_labels=EMOTION_LABELS,
            hypothesis_template="The tweet expresses {} emotion.",
        )

        signal_payload: Dict[str, Dict[str, float]] = {"positive": {}, "negative": {}, "neutral": {}}
        for label, score in zip(emotion_result["labels"], emotion_result["scores"]):
            polarity_bucket = SIGNAL_POLARITY.get(label, "neutral")
            if score >= settings.min_probability:
                signal_payload[polarity_bucket][label] = float(score)

        return {
            "primary": {
                "positive": positive,
                "negative": negative,
                "neutral": neutral,
                "label": top_label,
                "confidence": float(top_score),
            },
            "signals": signal_payload,
        }


@lru_cache(maxsize=1)
def get_analyzer() -> SentimentAnalyzer:
    """Return a cached analyzer instance."""
    return SentimentAnalyzer()
