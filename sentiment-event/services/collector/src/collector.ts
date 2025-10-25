import { appendJsonl, FileQueueClient, getLogger, getRuntimeConfig, hashText, normalizeText, detectLanguage } from "@pkg/shared";
import { CleanPost, CleanPostSchema, EventSpec, RawPost } from "@pkg/schemas";
import { createRssAdapter, SourceAdapter } from "@pkg/adapters";
import { join } from "path";

const logger = getLogger();

export interface CollectorOptions {
  event: EventSpec;
  pollIntervalMs?: number;
  sinceISO?: string;
}

const DEFAULT_POLL_INTERVAL = 60_000;

const cleanPost = (raw: RawPost, allowAllLangs: boolean): CleanPost | null => {
  const normalized = normalizeText(raw.text, { redactHandles: true });
  const language = detectLanguage(normalized);
  if (!allowAllLangs && !language.reliable) {
    return null;
  }
  if (!allowAllLangs && language.lang !== "en") {
    return null;
  }
  return CleanPostSchema.parse({
    ...raw,
    textClean: normalized,
    lang: language.lang,
    meta: {
      ...raw.meta,
      langDetection: language
    }
  });
};

const rawDataPath = (event: EventSpec) => {
  const day = new Date().toISOString().slice(0, 10);
  return join(process.cwd(), "data", "raw", event.id, `${day}.jsonl`);
};

const queueForEvent = (event: EventSpec) =>
  new FileQueueClient<CleanPost>({ queueName: `clean-${event.id}` });

export class CollectorRunner {
  private readonly sources: SourceAdapter[];
  private readonly queue: FileQueueClient<CleanPost>;
  private readonly seen = new Set<string>();
  private readonly pollIntervalMs: number;
  private lastRunISO: string | undefined;

  constructor(private readonly options: CollectorOptions) {
    const config = getRuntimeConfig();
    this.sources = [createRssAdapter()].filter((adapter) => adapter.isEnabled());
    this.queue = queueForEvent(options.event);
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL;
    this.lastRunISO = options.sinceISO;
    if (this.sources.length === 0) {
      logger.warn("collector.no_sources_enabled");
    }
  }

  async runOnce() {
    const config = getRuntimeConfig();
    const since = this.lastRunISO;
    for (const source of this.sources) {
      const rawPosts = await source.fetch(this.options.event, { sinceISO: since });
      for (const raw of rawPosts) {
        const dedupeKey = hashText(`${raw.source}:${raw.id}:${raw.url}`);
        if (this.seen.has(dedupeKey)) {
          continue;
        }
        this.seen.add(dedupeKey);
        await appendJsonl(rawDataPath(this.options.event), raw);
        const clean = cleanPost(raw, config.allowAllLangs);
        if (!clean) {
          continue;
        }
        await this.queue.enqueue(clean);
      }
    }
    this.lastRunISO = new Date().toISOString();
  }

  async start() {
    logger.info({ eventId: this.options.event.id }, "collector.start");
    await this.runOnce();
    setInterval(() => {
      this.runOnce().catch((error) => logger.error({ error }, "collector.run.error"));
    }, this.pollIntervalMs);
  }
}
