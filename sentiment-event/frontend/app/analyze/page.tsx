"use client";

import { FormEvent, useState } from "react";
import SentimentSummary from "@/components/SentimentSummary";
import type { SentimentResponse, SentimentApiError } from "@/types/sentiment";

const examplePrompt = `For example: "The latest noise-cancelling headphones AirPod Pro Max sound incredible, but early users say the app setup feels clunky."`;

export default function AnalyzePage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<SentimentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = text.trim();
    if (!input) {
      setError("Please describe a product, feature, or campaign to analyze.");
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });

      const payload = (await response.json()) as SentimentResponse | SentimentApiError;

      if (!response.ok || "error" in payload) {
        const message = "error" in payload ? payload.error : "Unable to fetch sentiment analysis.";
        throw new Error(message);
      }

      setResult(payload as SentimentResponse);
    } catch (err) {
      const fallback = err instanceof Error ? err.message : "Unexpected error. Please try again.";
      setError(fallback);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page">
      <section className="analysis-panel">
        <header>
          <h1 className="section-heading fade-up">Usage guide & live analyzer</h1>
          <div className="instructions fade-up delay-1">
            <p>
              1. Make sure the Python backend is running with an endpoint that accepts <code>POST /analyze</code> and
              returns the sentiment payload described in <code>backend/app/sentiment.py</code>.
            </p>
            <p>
              2. Set the <code>BACKEND_API_URL</code> environment variable for this Next.js app so the proxy knows where to send requests.
            </p>
            <p>
              3. Describe a product launch, feature update, or customer conversation in the text area below, then submit to see headline sentiment and supporting emotions.
            </p>
            <p>{examplePrompt}</p>
          </div>
        </header>

        <form className="analyze-form" onSubmit={handleSubmit}>
          <label htmlFor="product-input">What are we analyzing?</label>
          <textarea
            id="product-input"
            name="product"
            placeholder="Summarize the product moment you want to measure, like a feature rollout or launch reaction..."
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={isLoading}
          />
          <div className="hero-actions fade-up delay-2">
            <button type="submit" className="button-primary" disabled={isLoading}>
              {isLoading ? "Analyzing..." : "Run sentiment"}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setText("");
                setResult(null);
                setError(null);
              }}
              disabled={isLoading}
            >
              Clear
            </button>
          </div>
        </form>

        {error && <div className="status-banner error fade-up">{error}</div>}
        {result && !error && (
          <div className="fade-up" style={{ animationDelay: "0.15s" }}>
            <h2 className="section-heading">Sentiment breakdown</h2>
            <p className="section-subtitle">
              Primary sentiment probabilities are paired with supporting emotion cues. Use both to understand how people feel and why the tone might shift.
            </p>
            <SentimentSummary result={result} />
          </div>
        )}
      </section>
    </div>
  );
}
