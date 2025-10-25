import { SentimentDoc, TrendPoint } from "./index";

export type AnalysisEnvelope =
  | { kind: "sentiment-doc"; data: SentimentDoc }
  | { kind: "trend-point"; data: TrendPoint };
