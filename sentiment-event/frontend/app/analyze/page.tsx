"use client";

import { FormEvent, useState } from "react";
import type { StoredTweetsResponse, SentimentApiError } from "@/types/sentiment";

const examplePrompt = `For example: "The latest noise-cancelling headphones AirPod Pro Max sound incredible, but early users say the app setup feels clunky."`;

export default function AnalyzePage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<StoredTweetsResponse | null>(null);
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
        body: JSON.stringify({ keyword: input }),
      });

  const payload = (await response.json()) as StoredTweetsResponse | SentimentApiError;

      if (!response.ok || "error" in payload) {
        const message = "error" in payload ? payload.error : "Unable to fetch sentiment analysis.";
        throw new Error(message);
      }

  setResult(payload as StoredTweetsResponse);
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
              1. Start the FastAPI server: <code>uvicorn app.api:app --host 0.0.0.0 --port 8000</code>
            </p>
            <p>
              2. (Optional) Refresh the dataset by running <code>python main.py run &quot;your keyword&quot;</code> from the
              <code>backend</code> directory.
            </p>
            <p>
              3. Enter a keyword below to see how many tweets are currently stored for that topic.
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
            <h2 className="section-heading">Stored tweet count</h2>
            <p className="section-subtitle">{result.message}</p>
            <div className="feature-grid">
              <article className="feature-card">
                <h3>Total stored tweets</h3>
                <p>{result.storedTweets}</p>
              </article>
              <article className="feature-card">
                <h3>Analyzed sample size</h3>
                <p>{result.sampleSize}</p>
              </article>
              {result.latestTweetAt && (
                <article className="feature-card">
                  <h3>Latest tweet recorded</h3>
                  <p>{new Date(result.latestTweetAt).toLocaleString()}</p>
                </article>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
