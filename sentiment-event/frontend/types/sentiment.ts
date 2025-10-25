export interface SentimentPrimary {
  positive: number;
  negative: number;
  neutral: number;
  label: string;
  confidence: number;
}

export interface SentimentSignals {
  positive: Record<string, number>;
  negative: Record<string, number>;
  neutral: Record<string, number>;
}

export interface SentimentResponse {
  primary: SentimentPrimary;
  signals: SentimentSignals;
  meta?: SentimentMeta;
}

export interface SentimentApiError {
  error: string;
}

export interface SentimentMeta {
  keyword: string;
  sampleSize: number;
  totalTweets: number;
  newlyScraped: number;
  newlyAnalyzed: number;
  latestTweetAt?: string | null;
}
