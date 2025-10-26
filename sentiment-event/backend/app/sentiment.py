"""Sentiment and emotion analysis utilities."""

from __future__ import annotations

from functools import lru_cache
from typing import Dict, List, Literal

from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline

from .config import settings

PRIMARY_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
EMOTION_MODEL = "facebook/bart-large-mnli"
FAST_MODEL = "distilbert-base-uncased-finetuned-sst-2-english"
EMOTION_LABELS = [
    # Core negative emotions
    "fear",
    "anger",
    "greed",
    "sadness",
    "disgust",
    "envy",
    "shame",
    "guilt",
    "boredom",
    "frustration",
    "loneliness",
    "confusion",

    # Core positive emotions
    "joy",
    "trust",
    "love",
    "hope",
    "anticipation",
    "desire",
    "gratitude",
    "relief",
    "excitement",
    "pride",
    "curiosity",
    "confidence",

    # Neutral or mixed-valence emotions
    "surprise",
    "awe",
    "interest",
    "nostalgia",
    "calm",
    "neutrality",
    "tension",
    "disappointment",
]

SIGNAL_POLARITY = {
    # Negative
    "fear": "negative",
    "anger": "negative",
    "greed": "negative",
    "sadness": "negative",
    "disgust": "negative",
    "envy": "negative",
    "shame": "negative",
    "guilt": "negative",
    "boredom": "negative",
    "frustration": "negative",
    "loneliness": "negative",
    "confusion": "negative",
    "disappointment": "negative",

    # Positive
    "joy": "positive",
    "trust": "positive",
    "love": "positive",
    "hope": "positive",
    "anticipation": "positive",
    "desire": "positive",
    "gratitude": "positive",
    "relief": "positive",
    "excitement": "positive",
    "pride": "positive",
    "curiosity": "positive",
    "confidence": "positive",
    "awe": "positive",
    "nostalgia": "positive",
    "calm": "positive",

    # Neutral
    "surprise": "neutral",
    "interest": "neutral",
    "neutrality": "neutral",
    "tension": "neutral",
}


AnalyzerVariant = Literal["default", "fast"]


def _empty_analysis() -> Dict[str, Dict[str, float]]:
    return {
        "primary": {
            "positive": 0.0,
            "negative": 0.0,
            "neutral": 1.0,
            "label": "neutral",
            "confidence": 1.0,
        },
        "signals": {"positive": {}, "negative": {}, "neutral": {}},
    }


class SentimentAnalyzer:
    """Wrapper around transformer pipelines for user content analysis."""

    def __init__(self) -> None:
        # Manually load transformers objects so cache_dir does not leak into tokenizer kwargs.
        sentiment_model = AutoModelForSequenceClassification.from_pretrained(
            PRIMARY_MODEL,
            cache_dir=str(settings.model_cache_dir),
        )
        sentiment_tokenizer = AutoTokenizer.from_pretrained(
            PRIMARY_MODEL,
            cache_dir=str(settings.model_cache_dir),
            use_fast=True,
        )
        self._sentiment_pipeline = pipeline(
            task="sentiment-analysis",
            model=sentiment_model,
            tokenizer=sentiment_tokenizer,
        )

        emotion_model = AutoModelForSequenceClassification.from_pretrained(
            EMOTION_MODEL,
            cache_dir=str(settings.model_cache_dir),
        )
        emotion_tokenizer = AutoTokenizer.from_pretrained(
            EMOTION_MODEL,
            cache_dir=str(settings.model_cache_dir),
            use_fast=True,
        )
        self._emotion_pipeline = pipeline(
            task="zero-shot-classification",
            model=emotion_model,
            tokenizer=emotion_tokenizer,
            multi_label=True,
        )

    def analyze(self, text: str) -> Dict[str, Dict[str, float]]:
        """Return positive/negative probabilities with granular signals."""
        return self.analyze_many([text])[0]

    @staticmethod
    def _build_payload(sentiment_scores, emotion_result) -> Dict[str, Dict[str, float]]:
        built = {score["label"].lower(): float(score["score"]) for score in sentiment_scores}
        positive = float(built.get("positive", 0.0))
        negative = float(built.get("negative", 0.0))
        neutral = float(built.get("neutral", 0.0))

        candidates = {"positive": positive, "negative": negative, "neutral": neutral}
        top_label = max(candidates, key=candidates.get)
        top_score = candidates[top_label]

        signal_payload: Dict[str, Dict[str, float]] = {"positive": {}, "negative": {}, "neutral": {}}
        if isinstance(emotion_result, dict):
            labels = emotion_result.get("labels", [])
            scores = emotion_result.get("scores", [])
            for label, score in zip(labels, scores):
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

    def analyze_many(self, texts: List[str]) -> List[Dict[str, Dict[str, float]]]:
        results: List[Dict[str, Dict[str, float]]] = [_empty_analysis() for _ in texts]
        pending_indices: List[int] = []
        pending_texts: List[str] = []

        for idx, text in enumerate(texts):
            stripped = text.strip()
            if not stripped:
                continue
            pending_indices.append(idx)
            pending_texts.append(stripped)

        if not pending_texts:
            return results

        sentiment_outputs = self._sentiment_pipeline(
            pending_texts,
            return_all_scores=True,
            truncation=True,
            max_length=512,
            batch_size=settings.sentiment_batch_size,
        )
        if isinstance(sentiment_outputs, dict):
            sentiment_outputs = [sentiment_outputs]

        emotion_outputs = self._emotion_pipeline(
            sequences=pending_texts,
            candidate_labels=EMOTION_LABELS,
            hypothesis_template="The content expresses {} emotion.",
            batch_size=settings.sentiment_batch_size,
        )
        if isinstance(emotion_outputs, dict):
            emotion_outputs = [emotion_outputs]

        for idx, sentiment_scores, emotion_result in zip(pending_indices, sentiment_outputs, emotion_outputs):
            results[idx] = self._build_payload(sentiment_scores, emotion_result)

        return results


class FastSentimentAnalyzer:
    """Smaller DistilBERT-based analyzer for quick smoke tests."""

    def __init__(self) -> None:
        self._sentiment_pipeline = pipeline(
            task="sentiment-analysis",
            model=FAST_MODEL,
            tokenizer=FAST_MODEL,
        )

    def analyze(self, text: str) -> Dict[str, Dict[str, float]]:
        return self.analyze_many([text])[0]

    def analyze_many(self, texts: List[str]) -> List[Dict[str, Dict[str, float]]]:
        results: List[Dict[str, Dict[str, float]]] = [_empty_analysis() for _ in texts]
        pending_indices: List[int] = []
        pending_texts: List[str] = []

        for idx, text in enumerate(texts):
            stripped = text.strip()
            if not stripped:
                continue
            pending_indices.append(idx)
            pending_texts.append(stripped)

        if not pending_texts:
            return results

        sentiment_batches = self._sentiment_pipeline(
            pending_texts,
            truncation=True,
            max_length=256,
            return_all_scores=True,
            batch_size=settings.sentiment_batch_size,
        )
        if isinstance(sentiment_batches, dict):
            sentiment_batches = [sentiment_batches]

        for idx, batch_scores in zip(pending_indices, sentiment_batches):
            mapped = {entry["label"].upper(): float(entry["score"]) for entry in batch_scores}
            positive = mapped.get("POSITIVE", 0.0)
            negative = mapped.get("NEGATIVE", 0.0)
            total = positive + negative

            if total > 1.0:
                positive /= total
                negative /= total

            positive = max(0.0, min(1.0, positive))
            negative = max(0.0, min(1.0, negative))
            neutral = max(0.0, 1.0 - (positive + negative))

            scores = {"positive": positive, "negative": negative, "neutral": neutral}
            top_label = max(scores, key=scores.get)
            top_score = scores[top_label]

            results[idx] = {
                "primary": {
                    "positive": positive,
                    "negative": negative,
                    "neutral": neutral,
                    "label": top_label,
                    "confidence": float(top_score),
                },
                "signals": {"positive": {}, "negative": {}, "neutral": {}},
            }

        return results


@lru_cache(maxsize=None)
def get_analyzer(variant: AnalyzerVariant = "default") -> SentimentAnalyzer | FastSentimentAnalyzer:
    """Return a cached analyzer variant."""

    if variant == "fast":
        return FastSentimentAnalyzer()
    return SentimentAnalyzer()
