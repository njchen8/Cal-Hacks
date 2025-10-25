import { getLogger, getOptionalEnv } from "@pkg/shared";
import { fetch } from "undici";
import { FetchActionResponse, FetchAgentsAdapter, FetchAgentDefinition, FetchObservationPayload } from "./types";

const logger = getLogger();

const DEFAULT_BASE_URL = "https://agents.fetch.ai";

class HttpFetchAgentsAdapter implements FetchAgentsAdapter {
  private readonly baseUrl: string;

  constructor(private readonly apiKey: string, baseUrl?: string) {
    this.baseUrl = baseUrl ?? DEFAULT_BASE_URL;
  }

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`
    };
  }

  async registerAgent(def: FetchAgentDefinition): Promise<void> {
    await fetch(`${this.baseUrl}/v1/agents`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(def)
    });
  }

  async sendObservation(agentName: string, payload: FetchObservationPayload): Promise<void> {
    await fetch(`${this.baseUrl}/v1/agents/${encodeURIComponent(agentName)}/observe`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload)
    });
  }

  async requestAction(agentName: string, context: Record<string, unknown>): Promise<FetchActionResponse | null> {
    const response = await fetch(`${this.baseUrl}/v1/agents/${encodeURIComponent(agentName)}/action`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(context)
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, "fetchAgents.requestAction_failed");
      return null;
    }

    const data = (await response.json()) as FetchActionResponse;
    return data;
  }
}

class InMemoryFetchAgentsAdapter implements FetchAgentsAdapter {
  private readonly registry = new Map<string, FetchAgentDefinition>();

  async registerAgent(def: FetchAgentDefinition): Promise<void> {
    this.registry.set(def.name, def);
    logger.info({ def }, "fetchAgents.mock.registered");
  }

  async sendObservation(agentName: string, payload: FetchObservationPayload): Promise<void> {
    logger.info({ agentName, payload }, "fetchAgents.mock.observation");
  }

  async requestAction(agentName: string, context: Record<string, unknown>): Promise<FetchActionResponse | null> {
    const agent = this.registry.get(agentName);
    if (!agent) {
      return null;
    }
    logger.info({ agentName, context }, "fetchAgents.mock.action");
    return {
      action: `noop:${agent.intent}`,
      confidence: 0.5
    };
  }
}

export const createFetchAgentsAdapter = (): FetchAgentsAdapter => {
  const apiKey = getOptionalEnv("FETCH_API_KEY");
  const baseUrl = getOptionalEnv("FETCH_API_BASE_URL");
  if (!apiKey) {
    return new InMemoryFetchAgentsAdapter();
  }
  return new HttpFetchAgentsAdapter(apiKey, baseUrl);
};

export * from "./types";
