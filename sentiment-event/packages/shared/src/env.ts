import { config } from "dotenv";

let loaded = false;

export const loadEnv = () => {
  if (!loaded) {
    config();
    loaded = true;
  }
};

export const boolFromEnv = (value: string | undefined, fallback = false) => {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

export const getEnv = (key: string, fallback?: string) => {
  loadEnv();
  const value = process.env[key];
  if (value === undefined) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Missing required env var ${key}`);
  }
  return value;
};

export const getOptionalEnv = (key: string) => {
  loadEnv();
  return process.env[key];
};
