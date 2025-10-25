import { SentimentDoc, TrendPoint } from "@pkg/schemas";

export type AnalysisEnvelope =
  | { kind: "sentiment-doc"; data: SentimentDoc }
  | { kind: "trend-point"; data: TrendPoint };
