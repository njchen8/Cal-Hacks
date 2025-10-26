"use client";

import { FormEvent, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { StoredContentResponse } from "@/types/sentiment";

const examplePrompt = `For example: "The latest noise-cancelling headphones AirPod Pro Max sound incredible, but early users say the app setup feels clunky."`;

export default function AnalyzePage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<StoredContentResponse | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [lavaSummary, setLavaSummary] = useState<string | null>(null);
  const [lavaMetadata, setLavaMetadata] = useState<{ keyword: string; csvPath?: string; summaryPath?: string } | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<"default" | "fast">("default");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  const nativeEvent = event.nativeEvent as Event & { submitter?: EventTarget | null };
  const submitter = (nativeEvent?.submitter ?? null) as HTMLElement | null;
    const engineAttr = submitter?.getAttribute("data-engine");
    const engine: "default" | "fast" = engineAttr === "fast" ? "fast" : "default";

    const input = text.trim();
    if (!input) {
      setError("Please describe a product, feature, or campaign to analyze.");
      setResult(null);
      return;
    }

    setIsLoading(true);
    setActiveEngine(engine);
    setError(null);
    setLogs([]);
  setLavaSummary(null);
  setResult(null);
  setLavaMetadata(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: input, engine }),
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

      const yieldToBrowser = async () =>
        new Promise<void>((resolve) => {
          if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
            window.requestAnimationFrame(() => resolve());
          } else {
            setTimeout(() => resolve(), 0);
          }
        });

      const updateFallbackSummary = (message: string) => {
        const storedMatch = message.match(/^([0-9]+)\s+content entries currently stored for '(.+)'\.?$/i);
        if (storedMatch) {
          const [, total, keywordFromLog] = storedMatch;
          fallbackSummary = {
            ...(fallbackSummary ?? {}),
            storedContent: Number(total),
            keyword: keywordFromLog,
            message,
          };
        }

        const sampleMatch = message.match(/Most recent summary used\s+([0-9]+)\s+content entries/i);
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
      };

      const handleEventLine = (rawLine: string): boolean => {
        try {
          const event = JSON.parse(rawLine) as {
            type: string;
            message?: string | { text: string; keyword: string; csvPath?: string; summaryPath?: string };
            payload?: StoredContentResponse;
          };
          if (event.type === "log" && typeof event.message === "string") {
            const message = event.message;
            setLogs((prev) => [...prev, message]);
            updateFallbackSummary(message);
            return true;
          }
          if (event.type === "lava") {
            if (typeof event.message === "string") {
              setLavaSummary(event.message.trim());
              return true;
            }

            if (event.message && typeof event.message === "object") {
              const { text, keyword: kw, csvPath, summaryPath } = event.message;
              if (typeof text === "string") {
                setLavaSummary(text.trim());
              }
              if (typeof kw === "string" || csvPath || summaryPath) {
                setLavaMetadata({
                  keyword: typeof kw === "string" ? kw : input,
                  csvPath: typeof csvPath === "string" ? csvPath : undefined,
                  summaryPath: typeof summaryPath === "string" ? summaryPath : undefined,
                });
              }
              return true;
            }
            return true;
          }
          if (event.type === "summary" && event.payload) {
            summaryPayload = event.payload;
          } else if (event.type === "error" && typeof event.message === "string") {
            throw new Error(event.message);
          }
        } catch (parseError) {
          // Ignore partial JSON fragments; they will be retried once more data arrives.
        }
        return false;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let appendedLog = false;

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }
          appendedLog = handleEventLine(trimmed) || appendedLog;
        }

        if (appendedLog) {
          await yieldToBrowser();
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        const trimmed = buffer.trim();
        const appended = handleEventLine(trimmed);
        if (appended) {
          await yieldToBrowser();
        }
      }

      const coerceFallbackSummary = (keywordFromInput: string, candidate: Partial<StoredContentResponse> | null) => {
        if (!candidate || candidate.storedContent === undefined) {
          return null;
        }

        return {
          keyword: candidate.keyword ?? keywordFromInput,
          storedContent: candidate.storedContent,
          sampleSize: candidate.sampleSize ?? 0,
          latestContentAt: candidate.latestContentAt ?? null,
          message:
            candidate.message ??
            `${candidate.storedContent} content entries currently stored for '${candidate.keyword ?? keywordFromInput}'.`,
        } satisfies StoredContentResponse;
      };

      if (!summaryPayload) {
        const builtFallback = coerceFallbackSummary(input, fallbackSummary);
        if (builtFallback) {
          summaryPayload = builtFallback;
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
              2. Scrape data from Twitter, Reddit, or Facebook:
            </p>
            <p>
              &nbsp;&nbsp;&nbsp;<code>python main.py run &quot;keyword&quot;</code> (Twitter)
            </p>
            <p>
              &nbsp;&nbsp;&nbsp;<code>python main.py run-reddit &quot;keyword&quot;</code> (Reddit)
            </p>
            <p>
              &nbsp;&nbsp;&nbsp;<code>python main.py run-facebook &quot;keyword&quot; --page-id PAGE_ID</code> (Facebook)
            </p>
            <p>
              &nbsp;&nbsp;&nbsp;Add <code>--engine fast</code> for lightweight sentiment analysis.
            </p>
            <p>
              3. Enter a keyword below to analyze stored content and generate AI summaries via Gemini.
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
          <div className="hero-actions fade-up delay-2" style={{ gap: "0.75rem", display: "flex" }}>
            <button type="submit" className="button-primary" data-engine="default" disabled={isLoading}>
              {isLoading ? "Analyzing..." : "Run full sentiment"}
            </button>
            <button type="submit" className="button-secondary" data-engine="fast" disabled={isLoading}>
              {isLoading ? "Analyzing..." : "Run fast test sentiment"}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setText("");
                setResult(null);
                setError(null);
                setLogs([]);
                setActiveEngine("default");
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
            <span>
              {activeEngine === "fast" ? "Running fast sentiment analyzer…" : "Running full sentiment analyzer…"}
            </span>
          </div>
        )}

        {error && <div className="status-banner error fade-up">{error}</div>}
        {lavaSummary && (
          <div className="status-banner info fade-up" style={{ marginTop: "1.5rem" }}>
            <h2 className="section-heading" style={{ marginBottom: "0.75rem" }}>
              Gemini AI summary
            </h2>
            <div className="lava-output">
              {lavaMetadata && (
                <p className="lava-meta">
                  Keyword <strong>{lavaMetadata.keyword}</strong>
                  {lavaMetadata.summaryPath ? ` · Summary: ${lavaMetadata.summaryPath}` : null}
                  {lavaMetadata.csvPath ? ` · CSV: ${lavaMetadata.csvPath}` : null}
                </p>
              )}
              <ReactMarkdown>{lavaSummary}</ReactMarkdown>
            </div>
          </div>
        )}
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

        .lava-output {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 1.5rem;
          font-family: "Nunito", system-ui, sans-serif;
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--color-text-primary);
        }

        .lava-output h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: var(--color-primary);
        }

        .lava-output h2:first-child {
          margin-top: 0;
        }

        .lava-output p {
          margin-bottom: 1rem;
        }

        .lava-output strong {
          font-weight: 700;
          color: var(--color-primary);
        }

        .lava-output ul {
          margin-left: 1.5rem;
          margin-bottom: 1rem;
        }

        .lava-output li {
          margin-bottom: 0.5rem;
        }
      `}</style>
      </section>
    </div>
  );
}
