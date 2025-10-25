import { z } from "zod";

export const EventSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  keywords: z.array(z.string().min(1)).nonempty(),
  startTimeISO: z.string().datetime(),
  endTimeISO: z.string().datetime(),
  locations: z.array(z.string().min(1)).optional(),
  trackedAccounts: z.array(z.string().min(1)).optional()
});

export type EventSpec = z.infer<typeof EventSpecSchema>;

export const RawPostSchema = z.object({
  id: z.string().min(1),
  source: z.enum(["rss", "reddit", "twitter", "youtube", "news"]),
  url: z.string().url(),
  author: z.string().default("unknown"),
  text: z.string().min(1),
  html: z.string().optional(),
  lang: z.string().optional(),
  createdAtISO: z.string().datetime(),
  meta: z.record(z.any()).default({})
});

export type RawPost = z.infer<typeof RawPostSchema>;

export const CleanPostSchema = RawPostSchema.extend({
  textClean: z.string().min(1),
  tokens: z.array(z.string()).optional()
});

export type CleanPost = z.infer<typeof CleanPostSchema>;

export const SentimentDocSchema = z.object({
  postId: z.string().min(1),
  sentiment: z.enum(["neg", "neu", "pos"], {
    invalid_type_error: "sentiment label must be neg|neu|pos"
  }),
  score: z.number().min(-1).max(1),
  emotions: z
    .object({
      joy: z.number().min(0).max(1),
      anger: z.number().min(0).max(1),
      fear: z.number().min(0).max(1),
      sadness: z.number().min(0).max(1),
      surprise: z.number().min(0).max(1)
    })
    .partial()
    .optional(),
  topics: z.array(z.string().min(1)).max(5).default([]),
  summary: z.string().min(1)
});

export type SentimentDoc = z.infer<typeof SentimentDocSchema>;

export const TrendPointSchema = z.object({
  tsISO: z.string().datetime(),
  volume: z.number().min(0),
  avgScore: z.number().min(-1).max(1),
  posShare: z.number().min(0).max(1),
  negShare: z.number().min(0).max(1),
  topTopics: z.array(z.string().min(1))
});

export type TrendPoint = z.infer<typeof TrendPointSchema>;
