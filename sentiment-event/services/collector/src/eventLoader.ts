import { readFile } from "fs/promises";
import { resolve } from "path";
import { EventSpec, EventSpecSchema } from "@pkg/schemas";

export const loadEventSpecFromFile = async (path: string): Promise<EventSpec> => {
  const absolute = resolve(path);
  const raw = await readFile(absolute, "utf8");
  const parsed = JSON.parse(raw);
  return EventSpecSchema.parse(parsed);
};

export const loadEventSpec = async (input?: string): Promise<EventSpec> => {
  if (!input) {
    throw new Error("Event spec path or inline JSON is required");
  }
  if (input.trim().startsWith("{")) {
    return EventSpecSchema.parse(JSON.parse(input));
  }
  return loadEventSpecFromFile(input);
};
