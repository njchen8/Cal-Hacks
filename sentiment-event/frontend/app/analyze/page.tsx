"use client";

import { FormEvent, useState } from "react";
import type { StoredContentResponse } from "@/types/sentiment";

const examplePrompt = `For example: "The latest noise-cancelling headphones AirPod Pro Max sound incredible, but early users say the app setup feels clunky."`;

export default function AnalyzePage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<StoredContentResponse | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
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
    setLogs([]);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: input }),
      });

      if (!response.ok || !response.body) {
        const fallback = await response.text();
        throw new Error(fallback || "Unable to fetch sentiment analysis.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
  let summaryPayload: StoredContentResponse | null = null;
  let fallbackSummary: Partial<StoredContentResponse> | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          const event = JSON.parse(trimmed) as { type: string; message?: string; payload?: StoredContentResponse };

          if (event.type === "log" && typeof event.message === "string") {
            const message = event.message!;
            setLogs((prev) => [...prev, message]);
            const storedMatch = message.match(/^(\d+)\s+content entries currently stored for '(.+)'\.?$/i);
            if (storedMatch) {
              const [, total, keywordFromLog] = storedMatch;
              fallbackSummary = {
                ...(fallbackSummary ?? {}),
                storedContent: Number(total),
                keyword: keywordFromLog,
                message,
              };
            }
            const sampleMatch = message.match(/Most recent summary used\s+(\d+)\s+content entries/i);
            if (sampleMatch) {
              fallbackSummary = {
                ...(fallbackSummary ?? {}),
                sampleSize: Number(sampleMatch[1]),
              };
            }
            const latestMatch = message.match(/Latest content entry recorded at\s+(.+)\.?$/i);
            if (latestMatch) {
              fallbackSummary = {
                ...(fallbackSummary ?? {}),
                latestContentAt: latestMatch[1],
              };
            }
          } else if (event.type === "summary" && event.payload) {
            summaryPayload = event.payload;
          } else if (event.type === "error" && typeof event.message === "string") {
            throw new Error(event.message);
          }
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim()) as { type: string; message?: string; payload?: StoredContentResponse };
          if (event.type === "log" && typeof event.message === "string") {
            const message = event.message!;
            setLogs((prev) => [...prev, message]);
            const storedMatch = message.match(/^(\d+)\s+content entries currently stored for '(.+)'\.?$/i);
            if (storedMatch) {
              const [, total, keywordFromLog] = storedMatch;
              fallbackSummary = {
                ...(fallbackSummary ?? {}),
                storedContent: Number(total),
                keyword: keywordFromLog,
                message,
              };
            }
            const sampleMatch = message.match(/Most recent summary used\s+(\d+)\s+content entries/i);
            if (sampleMatch) {
              fallbackSummary = {
                ...(fallbackSummary ?? {}),
                sampleSize: Number(sampleMatch[1]),
              };
            }
            const latestMatch = message.match(/Latest content entry recorded at\s+(.+)\.?$/i);
            if (latestMatch) {
              fallbackSummary = {
                ...(fallbackSummary ?? {}),
                latestContentAt: latestMatch[1],
              };
            }
          } else if (event.type === "summary" && event.payload) {
            summaryPayload = event.payload;
          } else if (event.type === "error" && typeof event.message === "string") {
            throw new Error(event.message);
          }
        } catch {
          // Ignore trailing partial JSON fragments.
        }
      }

      if (!summaryPayload) {
        if (fallbackSummary?.storedContent !== undefined) {
          summaryPayload = {
            keyword: fallbackSummary.keyword ?? input,
            storedContent: fallbackSummary.storedContent,
            sampleSize: fallbackSummary.sampleSize ?? 0,
            latestContentAt: fallbackSummary.latestContentAt ?? null,
            message:
              fallbackSummary.message ?? `${fallbackSummary.storedContent} content entries currently stored for '${fallbackSummary.keyword ?? input}'.`,
          };
        } else {
          throw new Error("Analysis completed without a summary response.");
        }
      }

      setResult(summaryPayload);
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
              3. Enter a keyword below to see how much user content is currently stored for that topic.
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

        {isLoading && !error && (
          <div className="status-banner info fade-up" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div
              style={{
                width: "100%",
                height: "8px",
                backgroundColor: "var(--surface-muted)",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <div
                className="loading-bar-fill"
                style={{
                  width: "100%",
                  height: "100%",
                  background: "linear-gradient(90deg, var(--accent) 0%, var(--accent-soft) 100%)",
                }}
              />
            </div>
            <span>Running backend analysis…</span>
          </div>
        )}

        {error && <div className="status-banner error fade-up">{error}</div>}
        {logs.length > 0 && (
          <div className="status-banner info fade-up" style={{ marginTop: "1.5rem" }}>
            <h2 className="section-heading" style={{ marginBottom: "0.75rem" }}>
              Live progress
            </h2>
            <pre className="log-window">{logs.join("\n")}</pre>
          </div>
        )}
        {result && !error && (
          <div className="fade-up" style={{ animationDelay: "0.15s" }}>
            <h2 className="section-heading">Stored content overview</h2>
            <p className="section-subtitle">{result.message}</p>
            <div className="feature-grid">
              <article className="feature-card">
                <h3>Total stored entries</h3>
                <p>{result.storedContent}</p>
              </article>
              <article className="feature-card">
                <h3>Analyzed entries</h3>
                <p>{result.sampleSize}</p>
              </article>
              {result.latestContentAt && (
                <article className="feature-card">
                  <h3>Latest content recorded</h3>
                  <p>{new Date(result.latestContentAt).toLocaleString()}</p>
                </article>
              )}
            </div>
          </div>
        )}
      <style jsx>{`
        @keyframes bluberriLoading {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(0%);
          }
        }

        .loading-bar-fill {
          transform: translateX(-100%);
          animation: bluberriLoading 1.2s ease-in-out infinite;
        }

        .log-window {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 1rem;
          font-family: "Fira Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
          font-size: 0.9rem;
          line-height: 1.4;
          max-height: 240px;
          overflow-y: auto;
          white-space: pre-wrap;
        }
      `}</style>
      </section>
    </div>
  );
}
