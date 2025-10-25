import Anthropic from "@anthropic-ai/sdk";
import { CleanPost, EventSpec, SentimentDoc, SentimentDocSchema } from "@pkg/schemas";
import { getLogger, globalMetrics, getOptionalEnv } from "@pkg/shared";
import { systemPrompt, userPromptTemplate } from "./prompts";
import { ClaudeAdapter, ClaudeResult } from "./types";

const logger = getLogger();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sentimentFromRaw = (raw: any): SentimentDoc | undefined => {
  try {
    return SentimentDocSchema.parse({
      postId: raw.id,
      sentiment: raw.sentiment?.label ?? raw.sentiment,
      score: raw.sentiment?.score ?? raw.score,
      emotions: raw.emotions,
      topics: raw.topics,
      summary: raw.summary
    });
  } catch (error) {
    logger.warn({ error, raw }, "claude.parse_failure");
    return undefined;
  }
};

export interface ClaudeClientOptions {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
  initialBackoffMs?: number;
  backoffMultiplier?: number;
}

export class ClaudeClient implements ClaudeAdapter {
  private anthropic: Anthropic | undefined;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly backoffMultiplier: number;

  constructor(private readonly options: ClaudeClientOptions) {
    this.model = options.model ?? "claude-3-5-sonnet-latest";
    this.maxRetries = options.maxRetries ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 1000;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
    if (options.apiKey) {
      this.anthropic = new Anthropic({ apiKey: options.apiKey });
    }
  }

  private ensureClient() {
    if (!this.anthropic) {
      throw new Error("Claude client is not configured with an API key");
    }
    return this.anthropic;
  }

  async analyzeBatch(event: EventSpec, posts: CleanPost[]): Promise<ClaudeResult> {
    if (!this.anthropic) {
      const fallback = new MockClaudeAdapter();
      return fallback.analyzeBatch(event, posts);
    }

    const start = Date.now();
    const anthropic = this.ensureClient();
    const userPrompt = userPromptTemplate({
      id: event.id,
      name: event.name,
      keywords: event.keywords,
      startTimeISO: event.startTimeISO,
      endTimeISO: event.endTimeISO,
      contentJson: JSON.stringify(
        posts.map((post) => ({
          id: post.id,
          text: post.textClean ?? post.text,
          createdAtISO: post.createdAtISO,
          source: post.source
        }))
      )
    });

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        const response = await anthropic.messages.create({
          model: this.model,
          system: systemPrompt,
          max_tokens: 1024,
          temperature: 0.1,
          messages: [
            {
              role: "user",
              content: userPrompt
            }
          ]
        });

        const usage = {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
          costUsd: undefined
        };

        const textContent = response.content
          .filter((item: { type: string }) => item.type === "text")
          .map((item: { type: string; text?: string }) => item.text ?? "")
          .join("\n");

        let parsed: any[] = [];
        try {
          parsed = JSON.parse(textContent);
        } catch (error) {
          logger.error({ textContent }, "claude.json_parse_failed");
          throw error;
        }

        const documents = parsed
          .map((item) => sentimentFromRaw(item))
          .filter((doc): doc is SentimentDoc => Boolean(doc));

        globalMetrics.recordDuration("claude.analyzeBatch", Date.now() - start);
        return {
          documents,
          usage
        };
      } catch (error: any) {
        attempt += 1;
        const status = error?.status ?? error?.response?.status;
        const retryable = status === 429 || (status >= 500 && status < 600);
        logger.warn(
          {
            err: error,
            attempt,
            retryable
          },
          "claude.batch_failure"
        );
        if (!retryable || attempt > this.maxRetries) {
          globalMetrics.incrementError("claude.analyzeBatch");
          throw error;
        }
        const backoff = this.initialBackoffMs * Math.pow(this.backoffMultiplier, attempt - 1);
        await sleep(backoff + Math.random() * 250);
      }
    }

    throw new Error("Failed to analyze batch after retries");
  }
}

export class MockClaudeAdapter implements ClaudeAdapter {
  async analyzeBatch(_event: EventSpec, posts: CleanPost[]): Promise<ClaudeResult> {
    const documents: SentimentDoc[] = posts.map((post) => {
      const lower = post.textClean.toLowerCase();
      let sentiment: SentimentDoc["sentiment"] = "neu";
      let score = 0;
      if (lower.includes("love") || lower.includes("amazing")) {
        sentiment = "pos";
        score = 0.6;
      } else if (lower.includes("hate") || lower.includes("angry")) {
        sentiment = "neg";
        score = -0.6;
      }
      return {
        postId: post.id,
        sentiment,
        score,
        topics: post.meta?.topics ?? [],
        summary: post.textClean.slice(0, 120)
      };
    });

    return {
      documents,
      usage: {
        inputTokens: 0,
        outputTokens: 0
      }
    };
  }
}

export * from "./types";

export const createClaudeAdapter = () => {
  const apiKey = getOptionalEnv("CLAUDE_API_KEY");
  const model = getOptionalEnv("CLAUDE_MODEL") ?? "claude-3-5-sonnet-latest";
  return new ClaudeClient({ apiKey, model });
};
