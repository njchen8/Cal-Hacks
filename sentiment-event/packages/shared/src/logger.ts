import pino, { Logger, LoggerOptions } from "pino";
import { loadEnv, getOptionalEnv } from "./env";

let baseLogger: Logger | undefined;

const createLogger = () => {
  loadEnv();
  const level = getOptionalEnv("LOG_LEVEL") ?? "info";
  const options: LoggerOptions = {
    level,
    formatters: {
      level(label: string) {
        return { level: label };
      }
    },
    timestamp: pino.stdTimeFunctions.isoTime
  };

  // Enable pino-pretty only in dev for console readability.
  if (getOptionalEnv("NODE_ENV") !== "production") {
    const transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname"
      }
    };
    return pino(options, pino.transport(transport));
  }

  return pino(options);
};

export const getLogger = () => {
  if (!baseLogger) {
    baseLogger = createLogger();
  }
  return baseLogger;
};
