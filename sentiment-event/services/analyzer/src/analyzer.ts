import { appendJsonl, FileQueueClient, getLogger } from "@pkg/shared";
import {
  AnalysisEnvelope,
  CleanPost,
  CleanPostSchema,
  EventSpec,
  SentimentDoc,
  SentimentDocSchema,
  TrendPointSchema
} from "@pkg/schemas";
import { createClaudeAdapter } from "@pkg/adapters";
import { join } from "path";
import { ClaudeAdapter } from "@pkg/adapters";

const logger = getLogger();

export interface AnalyzerOptions {
  event: EventSpec;
  batchSize?: number;
}

const DEFAULT_BATCH_SIZE = 25;

const analysisDataPath = (event: EventSpec) => {
  const day = new Date().toISOString().slice(0, 10);
  return join(process.cwd(), "data", "analysis", event.id, `${day}.jsonl`);
};

const queueNames = (event: EventSpec) => ({
  input: `clean-${event.id}`,
  output: `analysis-${event.id}`
});

const topTopics = (documents: SentimentDoc[]): string[] => {
  const counter = new Map<string, number>();
  for (const doc of documents) {
    for (const topic of doc.topics ?? []) {
      counter.set(topic, (counter.get(topic) ?? 0) + 1);
    }
  }
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
};

const trendPointFromDocs = (documents: SentimentDoc[]) => {
  if (documents.length === 0) {
    return null;
  }
  const volume = documents.length;
  const avgScore = documents.reduce((acc, doc) => acc + doc.score, 0) / volume;
  const posCount = documents.filter((doc) => doc.sentiment === "pos").length;
  const negCount = documents.filter((doc) => doc.sentiment === "neg").length;
  const trend = TrendPointSchema.parse({
    tsISO: new Date().toISOString(),
    volume,
    avgScore,
    posShare: posCount / volume,
    negShare: negCount / volume,
    topTopics: topTopics(documents)
  });
  return trend;
};

export class AnalyzerRunner {
  private readonly claude: ClaudeAdapter;
  private readonly inputQueue: FileQueueClient<CleanPost>;
  private readonly outputQueue: FileQueueClient<AnalysisEnvelope>;
  private readonly batchSize: number;

  constructor(private readonly options: AnalyzerOptions) {
    this.claude = createClaudeAdapter();
    const names = queueNames(options.event);
    this.inputQueue = new FileQueueClient<CleanPost>({ queueName: names.input });
    this.outputQueue = new FileQueueClient<AnalysisEnvelope>({ queueName: names.output });
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  }

  private async processBatch(messages: { id: string; payload: CleanPost }[]) {
    const posts = messages.map((msg) => CleanPostSchema.parse(msg.payload));
    if (posts.length === 0) {
      return;
    }
    const result = await this.claude.analyzeBatch(this.options.event, posts);
    const docs = result.documents.map((doc) => SentimentDocSchema.parse(doc));
    for (const doc of docs) {
      await appendJsonl(analysisDataPath(this.options.event), doc);
      await this.outputQueue.enqueue({ kind: "sentiment-doc", data: doc });
    }
    const trend = trendPointFromDocs(docs);
    if (trend) {
      await this.outputQueue.enqueue({ kind: "trend-point", data: trend });
    }
  }

  async pollOnce() {
    const messages = await this.inputQueue.dequeueBatch(this.batchSize);
    if (messages.length === 0) {
      return;
    }
    try {
      await this.processBatch(messages.map((message) => ({ id: message.id, payload: message.payload })));
      await this.inputQueue.ack(messages.map((message) => message.id));
    } catch (error) {
      logger.error({ error }, "analyzer.batch_failed");
    }
  }

  start(intervalMs = 15_000) {
    logger.info({ eventId: this.options.event.id }, "analyzer.start");
    setInterval(() => {
      this.pollOnce().catch((error) => logger.error({ error }, "analyzer.poll_failed"));
    }, intervalMs);
  }
}
