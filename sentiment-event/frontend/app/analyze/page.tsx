"use client";

import { FormEvent, useState } from "react";
import SentimentSummary from "@/components/SentimentSummary";
import type { SentimentResponse, SentimentApiError } from "@/types/sentiment";

const examplePrompt = `Example keyword: "iphone"`;

export default function AnalyzePage() {
  const [keyword, setKeyword] = useState("");
  const [result, setResult] = useState<SentimentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = keyword.trim();
    if (!input) {
      setError("Please enter a keyword to analyze.");
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
              1. Start the backend server: <code>uvicorn app.api:app --host 0.0.0.0 --port 8000</code>
            </p>
            <p>
              2. Set <code>BACKEND_API_URL</code> for this Next.js project (defaults to <code>http://localhost:8000</code>).
            </p>
            <p>
              3. Enter a keyword below. The backend scrapes fresh tweets, analyzes sentiment, and returns the aggregated scores.
            </p>
            <p>{examplePrompt}</p>
          </div>
        </header>

        <form className="analyze-form" onSubmit={handleSubmit}>
          <label htmlFor="keyword-input">Keyword</label>
          <input
            id="keyword-input"
            name="keyword"
            type="text"
            placeholder="iphone, airpods, tesla, ..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
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
                setKeyword("");
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
        {result?.meta && !error && (
          <div className="status-banner success fade-up" style={{ animationDelay: "0.1s" }}>
            {result.meta.sampleSize > 0 || result.meta.totalTweets > 0 ? (
              <>Scraped {result.meta.newlyScraped} new tweets, analyzed {result.meta.newlyAnalyzed} tweets, using {result.meta.sampleSize} stored samples.</>
            ) : (
              <>No tweets with stored sentiment yet. Try a different keyword or check the backend logs.</>
            )}
          </div>
        )}
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
