import { EventSpec, CleanPost, SentimentDoc } from "@pkg/schemas";

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
}

export interface ClaudeResult {
  documents: SentimentDoc[];
  usage: ClaudeUsage;
}

export interface ClaudeAdapter {
  analyzeBatch(event: EventSpec, posts: CleanPost[]): Promise<ClaudeResult>;
}
