export interface SentimentApiError {
  error: string;
}

export interface StoredContentResponse {
  keyword: string;
  storedContent: number;
  sampleSize: number;
  latestContentAt?: string | null;
  message: string;
}
