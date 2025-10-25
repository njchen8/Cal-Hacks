import { FileQueueClient, getLogger } from "@pkg/shared";
import { AnalysisEnvelope, EventSpec, SentimentDoc, TrendPoint } from "@pkg/schemas";
import { RuleDefinition } from "./rules";
import { loadRulesFromFile } from "./rules";
import { createFetchAgentsAdapter, createLavaPublisher } from "@pkg/adapters";

const logger = getLogger();

export interface OrchestratorOptions {
  event: EventSpec;
  rulesPath: string;
  pollIntervalMs?: number;
}

interface OrchestratorState {
  volume: number;
  avgScore: number;
  posShare: number;
  negShare: number;
  topTopics: string[];
  trendHistory: TrendPoint[];
  topicCounts: Record<string, number>;
  lastUpdatedISO?: string;
}

interface TriggerRecord {
  id: string;
  ruleId: string;
  agentName: string;
  message: string;
  triggeredAtISO: string;
  action?: string | null;
}

const initialState = (): OrchestratorState => ({
  volume: 0,
  avgScore: 0,
  posShare: 0,
  negShare: 0,
  topTopics: [],
  trendHistory: [],
  topicCounts: {}
});

const queueNameForEvent = (event: EventSpec) => `analysis-${event.id}`;

export class OrchestratorRunner {
  private readonly queue: FileQueueClient<AnalysisEnvelope>;
  private readonly pollIntervalMs: number;
  private rules: RuleDefinition[] = [];
  private state: OrchestratorState = initialState();
  private readonly triggers: TriggerRecord[] = [];
  private readonly fetchAgents = createFetchAgentsAdapter();
  private readonly lava = createLavaPublisher();
  private readonly lastRuleTrigger = new Map<string, number>();

  constructor(private readonly options: OrchestratorOptions) {
    this.queue = new FileQueueClient<AnalysisEnvelope>({ queueName: queueNameForEvent(options.event) });
    this.pollIntervalMs = options.pollIntervalMs ?? 15_000;
  }

  async initialize() {
    this.rules = await loadRulesFromFile(this.options.rulesPath);
    // Register required agents
    const agentNames = new Set(this.rules.map((rule) => rule.agentName));
    for (const name of agentNames) {
      await this.fetchAgents.registerAgent({ name, intent: name, description: "Auto-generated rule agent" });
    }
  }

  private updateStateFromDoc(doc: SentimentDoc) {
    this.state.volume += 1;
    this.state.avgScore = this.state.avgScore + (doc.score - this.state.avgScore) / this.state.volume;
    const posIncrement = doc.sentiment === "pos" ? 1 : 0;
    const negIncrement = doc.sentiment === "neg" ? 1 : 0;
    const total = this.state.volume;
    this.state.posShare = ((this.state.posShare * (total - 1)) + posIncrement) / total;
    this.state.negShare = ((this.state.negShare * (total - 1)) + negIncrement) / total;
    for (const topic of doc.topics ?? []) {
      this.state.topicCounts[topic] = (this.state.topicCounts[topic] ?? 0) + 1;
    }
    this.state.topTopics = Object.entries(this.state.topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  private updateStateFromTrend(trend: TrendPoint) {
    this.state.trendHistory = [...this.state.trendHistory, trend].slice(-100);
    this.state.volume = trend.volume;
    this.state.avgScore = trend.avgScore;
    this.state.posShare = trend.posShare;
    this.state.negShare = trend.negShare;
    this.state.topTopics = trend.topTopics;
    this.state.topicCounts = Object.fromEntries(trend.topTopics.map((topic, index) => [topic, trend.volume - index]));
  }

  private async evaluateRules() {
    for (const rule of this.rules) {
      if (rule.type === "avgScoreThreshold") {
        if (this.state.avgScore < rule.threshold && this.state.volume >= rule.minVolume) {
          const last = this.lastRuleTrigger.get(rule.id) ?? 0;
          const now = Date.now();
          if (now - last < 5 * 60 * 1000) {
            continue;
          }
          await this.triggerRule(rule);
          this.lastRuleTrigger.set(rule.id, now);
        }
      }
    }
  }

  private async triggerRule(rule: RuleDefinition) {
    const payload = {
      eventId: this.options.event.id,
      state: this.state,
      message: rule.message,
      triggeredAt: new Date().toISOString()
    };
    await this.fetchAgents.sendObservation(rule.agentName, payload);
    const action = await this.fetchAgents.requestAction(rule.agentName, payload);
    await this.lava.publishTrigger({
      ruleId: rule.id,
      agentName: rule.agentName,
      context: payload
    });
    const record: TriggerRecord = {
      id: `${rule.id}-${Date.now()}`,
      ruleId: rule.id,
      agentName: rule.agentName,
      message: rule.message,
      triggeredAtISO: payload.triggeredAt,
      action: action?.action ?? null
    };
    this.triggers.push(record);
    this.triggers.splice(0, Math.max(0, this.triggers.length - 50));
    logger.info({ ruleId: rule.id, action }, "orchestrator.rule_triggered");
  }

  private async processMessage(message: AnalysisEnvelope) {
    if (message.kind === "sentiment-doc") {
      this.updateStateFromDoc(message.data);
    } else if (message.kind === "trend-point") {
      this.updateStateFromTrend(message.data);
      await this.lava.publishTrend([message.data]);
    }
    this.state.lastUpdatedISO = new Date().toISOString();
    await this.evaluateRules();
  }

  async pollOnce() {
    const messages = await this.queue.dequeueBatch(50);
    if (messages.length === 0) {
      return;
    }
    try {
      for (const message of messages) {
        await this.processMessage(message.payload);
      }
      await this.queue.ack(messages.map((message) => message.id));
    } catch (error) {
      logger.error({ error }, "orchestrator.poll_failed");
    }
  }

  start() {
    logger.info({ eventId: this.options.event.id }, "orchestrator.start");
    setInterval(() => {
      this.pollOnce().catch((error) => logger.error({ error }, "orchestrator.poll_tick_failed"));
    }, this.pollIntervalMs);
  }

  getState() {
    return {
      event: this.options.event,
      state: this.state,
      triggers: this.triggers.slice(-20)
    };
  }
}
