import express, { Request, Response } from "express";

export const startHealthServer = (port: number) => {
  const app = express();

  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      resolve();
    });
  });
};
