# Sentiment Event Platform

Event-centric sentiment analysis pipeline with collectors, analyzers, orchestrators, and realtime dashboards.

## Getting Started

1. Copy `.env.example` to `.env` and fill required keys.
2. Install dependencies: `pnpm install`.
3. Build all packages: `pnpm -r build`.
4. Start desired service (collector/analyzer/orchestrator/lava-bridge/web) via the scripts in `package.json`.

## Workspace Overview

```
packages/
  shared/         # shared utilities and base infrastructure
  schemas/        # canonical Zod schemas
  adapters/       # pluggable external service adapters
services/
  collector/      # source ingestion workers
  analyzer/       # Claude-based sentiment analysis
  orchestrator/   # rules engine + Fetch agents + Lava bridge triggers
  lava-bridge/    # Lava integration surface
  web/            # React dashboard (Vite)
```

## Data Layout

```
data/
  raw/<eventId>/YYYY-MM-DD.jsonl
  analysis/<eventId>/YYYY-MM-DD.jsonl
  lava_out/
```

## Demo Event

See `CONFIG_EVENT.json` for an example event to run with the collector.
