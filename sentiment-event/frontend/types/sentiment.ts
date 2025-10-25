export interface SentimentApiError {
  error: string;
}

export interface StoredTweetsResponse {
  keyword: string;
  storedTweets: number;
  sampleSize: number;
  latestTweetAt?: string | null;
  message: string;
}
