import { TrendPoint } from "@pkg/schemas";

export interface LavaTrendPayload {
  trend: TrendPoint[];
}

export interface LavaTriggerEvent {
  ruleId: string;
  agentName: string;
  context: Record<string, unknown>;
}

export interface LavaTopicLeaderboardEntry {
  topic: string;
  count: number;
  avgScore: number;
}

export interface LavaPublisher {
  publishTrend(points: TrendPoint[]): Promise<void>;
  publishTrigger(event: LavaTriggerEvent): Promise<void>;
  publishLeaderboard(entries: LavaTopicLeaderboardEntry[]): Promise<void>;
}
