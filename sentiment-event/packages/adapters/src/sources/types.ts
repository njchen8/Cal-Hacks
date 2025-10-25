import { EventSpec, RawPost } from "@pkg/schemas";

export interface SourceFetchOptions {
  sinceISO?: string;
  limit?: number;
}

export interface SourceAdapter {
  source: RawPost["source"];
  isEnabled(): boolean;
  fetch(event: EventSpec, options?: SourceFetchOptions): Promise<RawPost[]>;
}
