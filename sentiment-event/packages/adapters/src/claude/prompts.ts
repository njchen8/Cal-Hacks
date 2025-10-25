export const systemPrompt = `You are an analyst evaluating public online content about a specific Event.
For each item, classify sentiment about the Event only (ignore unrelated opinions),
return: label in {'neg','neu','pos'}, score in [-1,1], 1–5 key topics, a 1-sentence summary, and optional emotions.
Keep outputs compact and machine-readable JSON per item.`;

export const userPromptTemplate = (payload: {
  id: string;
  name: string;
  keywords: string[];
  startTimeISO: string;
  endTimeISO: string;
  contentJson: string;
}) => `EVENT:
- id: ${payload.id}
- name: ${payload.name}
- keywords: ${payload.keywords.join(", ")}
- time_window: ${payload.startTimeISO}..${payload.endTimeISO}
CONTENT_BATCH (JSON array of objects with fields: id, text, createdAtISO, source):
${payload.contentJson}
Required JSON output: array of objects
 [{id, sentiment:{label, score}, topics: string[], summary, emotions?:{joy,anger,fear,sadness,surprise}}]`;
