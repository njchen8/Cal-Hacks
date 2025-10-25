import express, { Request, Response, Application } from "express";
import { createLavaPublisher } from "@pkg/adapters";
import { TrendPoint, TrendPointSchema } from "@pkg/schemas";
import { getLogger, loadEnv } from "@pkg/shared";
import { z } from "zod";

const logger = getLogger();

const trendPointSchemaTyped = TrendPointSchema as unknown as z.ZodType<TrendPoint>;

const trendPayloadSchema: z.ZodType<{ trend: TrendPoint[] }> = z.object({
  trend: z.array(trendPointSchemaTyped)
});

const triggerSchema = z.object({
  ruleId: z.string().min(1),
  agentName: z.string().min(1),
  context: z.record(z.any())
});

const leaderboardSchema = z.object({
  topTopics: z.array(
    z.object({
      topic: z.string().min(1),
      count: z.number().min(0),
      avgScore: z.number().min(-1).max(1)
    })
  )
});

export const createServer = (): Application => {
  loadEnv();
  const lava = createLavaPublisher();
  const app = express();
  app.use(express.json());

  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.post("/metrics/trend", async (req: Request, res: Response) => {
    const parse = trendPayloadSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    await lava.publishTrend(parse.data.trend);
    res.json({ status: "accepted" });
  });

  app.post("/events/trigger", async (req: Request, res: Response) => {
    const parse = triggerSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    await lava.publishTrigger(parse.data);
    res.json({ status: "accepted" });
  });

  app.post("/leaderboard/topics", async (req: Request, res: Response) => {
    const parse = leaderboardSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    await lava.publishLeaderboard(parse.data.topTopics);
    res.json({ status: "accepted" });
  });

  return app;
};

export const startServer = (port: number) =>
  new Promise<void>((resolve) => {
    const app = createServer();
    app.listen(port, () => {
      logger.info({ port }, "lava-bridge.start");
      resolve();
    });
  });

if (require.main === module) {
  const port = Number(process.env.PORT ?? 4010);
  startServer(port).catch((error) => {
    logger.error({ error }, "lava-bridge.start_failed");
    process.exit(1);
  });
}
