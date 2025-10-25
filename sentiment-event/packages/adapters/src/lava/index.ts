import { appendJsonl, getLogger, getOptionalEnv } from "@pkg/shared";
import { fetch } from "undici";
import { LavaPublisher, LavaTopicLeaderboardEntry, LavaTriggerEvent } from "./types";
import { TrendPoint } from "@pkg/schemas";
import { join } from "path";

const logger = getLogger();

const DEFAULT_BASE_URL = "https://api.lava.ai";

class LavaRestPublisher implements LavaPublisher {
  private readonly baseUrl: string;

  constructor(private readonly apiKey: string, baseUrl?: string) {
    this.baseUrl = baseUrl ?? DEFAULT_BASE_URL;
  }

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`
    };
  }

  async publishTrend(points: TrendPoint[]): Promise<void> {
    await fetch(`${this.baseUrl}/metrics/trend`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ trend: points })
    });
  }

  async publishTrigger(event: LavaTriggerEvent): Promise<void> {
    await fetch(`${this.baseUrl}/events/trigger`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(event)
    });
  }

  async publishLeaderboard(entries: LavaTopicLeaderboardEntry[]): Promise<void> {
    await fetch(`${this.baseUrl}/leaderboard/topics`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ topTopics: entries })
    });
  }
}

class DryRunLavaPublisher implements LavaPublisher {
  constructor(private readonly outputDir: string) {}

  private async write(file: string, payload: unknown) {
    const target = join(this.outputDir, file);
    await appendJsonl(target, payload);
    logger.info({ target }, "lava.dry_run.write");
  }

  async publishTrend(points: TrendPoint[]): Promise<void> {
    await this.write("trend.jsonl", { ts: new Date().toISOString(), points });
  }

  async publishTrigger(event: LavaTriggerEvent): Promise<void> {
    await this.write("trigger.jsonl", { ts: new Date().toISOString(), event });
  }

  async publishLeaderboard(entries: LavaTopicLeaderboardEntry[]): Promise<void> {
    await this.write("leaderboard.jsonl", { ts: new Date().toISOString(), entries });
  }
}

export const createLavaPublisher = (): LavaPublisher => {
  const apiKey = getOptionalEnv("LAVA_API_KEY");
  const baseUrl = getOptionalEnv("LAVA_BASE_URL");
  if (!apiKey) {
    const outputDir = join(process.cwd(), "data", "lava_out");
    return new DryRunLavaPublisher(outputDir);
  }
  return new LavaRestPublisher(apiKey, baseUrl);
};

export * from "./types";
