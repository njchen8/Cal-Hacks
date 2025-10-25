import { boolFromEnv, getOptionalEnv, loadEnv } from "../env";

export type QueueImplementation = "file" | "memory";

export interface RuntimeConfig {
  allowAllLangs: boolean;
  queueImplementation: QueueImplementation;
  webhookOriginAllowlist: string[];
}

const parseAllowlist = (raw: string | undefined): string[] => {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

let cachedConfig: RuntimeConfig | undefined;

export const getRuntimeConfig = (): RuntimeConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  loadEnv();
  const allowAllLangs = boolFromEnv(process.env.ALLOW_ALL_LANGS, false);
  const queueImplementation = (getOptionalEnv("QUEUE_IMPLEMENTATION") as QueueImplementation) ?? "file";
  const webhookOriginAllowlist = parseAllowlist(getOptionalEnv("WEBHOOK_ORIGIN_ALLOWLIST"));

  cachedConfig = {
    allowAllLangs,
    queueImplementation,
    webhookOriginAllowlist
  };

  return cachedConfig;
};
