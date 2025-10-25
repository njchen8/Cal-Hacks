import type { SentimentResponse } from "@/types/sentiment";

interface SentimentSummaryProps {
  result: SentimentResponse;
}

const polarityLabels: Record<keyof SentimentResponse["signals"], string> = {
  positive: "Positive Signals",
  negative: "Negative Signals",
  neutral: "Neutral Signals",
};

const metricOrder: Array<keyof SentimentResponse["primary"]> = [
  "positive",
  "neutral",
  "negative",
  "confidence",
];

const metricLabel: Record<string, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  confidence: "Confidence",
};

const metricTone: Record<string, "positive" | "neutral" | "negative"> = {
  positive: "positive",
  negative: "negative",
  neutral: "neutral",
  confidence: "positive",
};

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function SentimentSummary({ result }: SentimentSummaryProps) {
  const primary = result.primary;

  return (
    <div className="result-grid">
      <article className="result-card">
        <h4>Primary Sentiment</h4>
        <div className="metric-row">
          <div className="metric-label">
            <span>Dominant Label</span>
            <span>{primary.label.charAt(0).toUpperCase() + primary.label.slice(1)}</span>
          </div>
        </div>
        {metricOrder.map((key) => {
          if (key === "label") {
            return null;
          }

          const tone = metricTone[key] || "neutral";
          const value = primary[key as keyof typeof primary];
          if (typeof value !== "number") {
            return null;
          }

          return (
            <div key={key} className="metric-row">
              <div className="metric-label">
                <span>{metricLabel[key]}</span>
                <span>{formatPercent(value)}</span>
              </div>
              <div className="metric-bar">
                <div
                  className={`metric-fill ${tone}`}
                  style={{ width: `${Math.max(5, Math.min(100, value * 100))}%` }}
                />
              </div>
            </div>
          );
        })}
      </article>

      {Object.entries(result.signals).map(([polarity, entries]) => {
        const pairs = Object.entries(entries);
        return (
          <article key={polarity} className="result-card">
            <h4>{polarityLabels[polarity as keyof typeof polarityLabels]}</h4>
            {pairs.length === 0 ? (
              <p className="section-subtitle">No signals crossed the probability threshold.</p>
            ) : (
              <div className="signal-group">
                {pairs.map(([label, rawValue]) => {
                  if (typeof rawValue !== "number") {
                    return null;
                  }

                  return (
                    <div key={label} className={`signal-chip ${polarity}`}>
                      <span>{label.charAt(0).toUpperCase() + label.slice(1)}</span>
                      <span>{formatPercent(rawValue)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
