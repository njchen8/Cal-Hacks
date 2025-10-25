import { describe, it, expect } from "vitest";
import { systemPrompt, userPromptTemplate } from "../prompts";

describe("Claude prompts", () => {
  it("renders system prompt verbatim", () => {
    expect(systemPrompt).toContain("You are an analyst evaluating public online content about a specific Event.");
  });

  it("creates user prompt with event details", () => {
    const prompt = userPromptTemplate({
      id: "demo",
      name: "Demo Event",
      keywords: ["alpha", "beta"],
      startTimeISO: "2025-01-01T00:00:00.000Z",
      endTimeISO: "2025-01-02T00:00:00.000Z",
      contentJson: "[]"
    });

    expect(prompt).toContain("EVENT:");
    expect(prompt).toContain("alpha, beta");
    expect(prompt).toContain("[]");
  });
});
