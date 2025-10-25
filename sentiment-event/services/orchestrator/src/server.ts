import express, { Request, Response, NextFunction, Application } from "express";
import { OrchestratorRunner } from "./orchestrator";
import { getRuntimeConfig, getLogger } from "@pkg/shared";

const logger = getLogger();

export const createServer = (runner: OrchestratorRunner): Application => {
  const app = express();
  app.use(express.json());

  const { webhookOriginAllowlist } = getRuntimeConfig();

  const originGuard = (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "POST" || webhookOriginAllowlist.length === 0) {
      return next();
    }
    const origin = (req.headers["origin"] as string | undefined) ?? (req.headers["referer"] as string | undefined);
    if (origin && webhookOriginAllowlist.includes(origin)) {
      return next();
    }
    logger.warn({ origin }, "orchestrator.webhook_rejected");
    return res.status(403).json({ error: "origin_not_allowlisted" });
  };

  app.use(originGuard);

  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/state", (_req: Request, res: Response) => {
    res.json(runner.getState());
  });

  app.get("/triggers", (_req: Request, res: Response) => {
    res.json({ triggers: runner.getState().triggers });
  });

  return app;
};

export const startServer = (runner: OrchestratorRunner, port: number) =>
  new Promise<void>((resolve) => {
    const app = createServer(runner);
    app.listen(port, () => resolve());
  });
