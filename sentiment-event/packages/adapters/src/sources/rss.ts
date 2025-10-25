import Parser from "rss-parser";
import { getLogger, getOptionalEnv } from "@pkg/shared";
import { EventSpec, RawPost } from "@pkg/schemas";
import { SourceAdapter, SourceFetchOptions } from "./types";

const logger = getLogger();

const DEFAULT_LIMIT = 100;

const feedsFromEnv = () => {
  const value = getOptionalEnv("RSS_FEEDS");
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item: string) => item.trim())
    .filter((item: string) => item.length > 0);
};

const matchesKeywords = (text: string, keywords: string[]) => {
  const lower = text.toLowerCase();
  return keywords.some((term) => lower.includes(term.toLowerCase()));
};

export class RssSourceAdapter implements SourceAdapter {
  readonly source = "rss" as const;

  private readonly parser = new Parser({ timeout: 10_000 });

  isEnabled(): boolean {
    return feedsFromEnv().length > 0;
  }

  async fetch(event: EventSpec, options?: SourceFetchOptions): Promise<RawPost[]> {
    const feeds = feedsFromEnv();
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const sinceDate = options?.sinceISO ? new Date(options.sinceISO) : undefined;

    const posts: RawPost[] = [];

    for (const feed of feeds) {
      try {
        const parsed = await this.parser.parseURL(feed);
        for (const item of parsed.items.slice(0, limit)) {
          const pubDate = item.isoDate ?? item.pubDate;
          const link = item.link;

          if (!link) {
            continue;
          }
          if (sinceDate && pubDate) {
            const itemDate = new Date(pubDate);
            if (itemDate < sinceDate) {
              continue;
            }
          }

          const text = `${item.title ?? ""} ${item.contentSnippet ?? ""}`.trim();
          if (text.length === 0) {
            continue;
          }

          if (!matchesKeywords(text, event.keywords)) {
            continue;
          }

          const raw: RawPost = {
            id: item.guid ?? link ?? `${this.source}-${item.title ?? Math.random()}`,
            source: this.source,
            url: link,
            author: parsed.title ?? "unknown",
            text,
            html: item['content:encoded'] ?? item.content,
            lang: undefined,
            createdAtISO: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            meta: {
              feed,
              feedTitle: parsed.title,
              categories: item.categories ?? [],
              keywords: event.keywords
            }
          };
          posts.push(raw);
        }
      } catch (error) {
        logger.error({ feed, error }, "rss.fetch_failed");
      }
    }

    return posts.slice(0, limit);
  }
}

export const createRssAdapter = () => new RssSourceAdapter();
