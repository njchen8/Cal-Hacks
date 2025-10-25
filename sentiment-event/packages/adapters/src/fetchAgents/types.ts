export interface FetchAgentDefinition {
  name: string;
  intent: string;
  description?: string;
}

export interface FetchObservationPayload {
  [key: string]: unknown;
}

export interface FetchActionResponse {
  action: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface FetchAgentsAdapter {
  registerAgent(def: FetchAgentDefinition): Promise<void>;
  sendObservation(agentName: string, payload: FetchObservationPayload): Promise<void>;
  requestAction(agentName: string, context: Record<string, unknown>): Promise<FetchActionResponse | null>;
}
