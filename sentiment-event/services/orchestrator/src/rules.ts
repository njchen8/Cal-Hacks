import { readFile } from "fs/promises";
import { resolve } from "path";
import { z } from "zod";

export const RuleSchema = z.object({
  id: z.string().min(1),
  type: z.literal("avgScoreThreshold"),
  threshold: z.number().min(-1).max(1),
  minVolume: z.number().min(0),
  agentName: z.string().min(1),
  message: z.string().min(1)
});

export type RuleDefinition = z.infer<typeof RuleSchema>;

export const loadRulesFromFile = async (path: string): Promise<RuleDefinition[]> => {
  const absolute = resolve(path);
  const raw = await readFile(absolute, "utf8");
  const parsed = JSON.parse(raw);
  return z.array(RuleSchema).parse(parsed);
};
