# OGBoard — Project Context

## What this is

A small OG inspection tool for designers and researchers.

Core use cases:

- inspect OG metadata and preview images for a URL
- bulk-fetch competitor URLs into a visual grid
- save a persistent collection and share it with a public link
- keep saved collections as snapshots, not live re-scrapes

No auth. Collection editing is owner-token based.

## Stack

- **Framework**: TanStack Start v1 (`createServerFn`, TanStack Router, Vite)
- **Styling**: Tailwind v4 + inline OKLCH styles
- **State**: TanStack Query v5
- **Storage**:
  - Upstash Redis in production for OG cache + collections + home workspace drafts
  - in-memory fallback only in local/dev when Upstash env vars are missing
- **Scraping**:
  - tier 1: `open-graph-scraper`
  - tier 2 fallback: `@microlink/mql` with palette extraction
- **Queue**: `p-queue` for client-side bulk fetch orchestration
- **Deploy**: Vercel

## Architectural Rules

- **Server functions use `.inputValidator()`**, not `.validator()`.
- **Never import `.server.ts` files in components**. Cross the RPC boundary through `src/functions/*.functions.ts`.
- **All server-side URL fetching must go through the public-URL policy** in `src/server/og/url-policy.server.ts`.
- **Only `http` and `https` are supported**. Bare domains like `vercel.com` are normalized to `https://vercel.com/`.
- **Collections are snapshot-based**. Saved items should render from stored `ogData` when available instead of re-fetching live data.
- **The home workspace on `/` is backend-backed**. It auto-saves a draft workspace to Redis and restores it on refresh.
- **Bulk fetch remains client-side** so TanStack Query can cache per URL and reuse server results.
- **Query retries are intentionally disabled** for OG fetches to avoid console spam and noisy repeated failures.
- **Path alias**: `#/` maps to `src/`.

## Backend Pipeline

### OG fetch path

1. User input is normalized in `src/lib/domain.ts`
2. `fetchOGFn` validates the input and enforces the public URL policy
3. `fetchOG()` checks Redis/in-memory cache
4. Tier 1 fetch tries `open-graph-scraper`
5. Tier 2 fallback tries Microlink
6. Success is cached for 24h
7. Failures are negatively cached for 5 minutes to prevent repeated upstream hammering

### Collection path

1. `saveCollFn` creates `id + ownerToken`
2. Client stores owner token in `localStorage` as `col-token-{id}`
3. Collection items persist `ogData` snapshots alongside URL, tags, and ordering metadata
4. `patchCollFn` validates the full payload and uses a revision check to reject stale writes
5. `getCollFn` strips `ownerToken` from public responses

### Home workspace draft path

1. `/` keeps a browser-local snapshot for instant reload recovery
2. the page auto-saves a draft workspace to Redis through `workspace.functions.ts`
3. refresh restores from local snapshot first, then reconciles with the backend draft
4. production requires Redis env vars for this to work durably

## File Map

```text
src/
  functions/
    og.functions.ts
    collection.functions.ts
  server/
    redis.ts
    og/
      scrape.server.ts
      detect.server.ts
      hash.ts
      url-policy.server.ts
    collection/
      store.server.ts
    workspace/
      store.server.ts
  queries/
    og.queries.ts
    collection.queries.ts
  hooks/
    useBulkOGFetch.ts
    useOwnerToken.ts
  lib/
    constants.ts
    detection.ts
    domain.ts
  routes/
    index.tsx
    c.$id.tsx
  components/
    cards/
    layout/
    grid/
    collection/
```

## Storage Semantics

### OG cache

- key: `og:{sha256(normalizedUrl)}`
- success TTL: `86400`
- error key: `ogerr:{sha256(normalizedUrl)}`
- error TTL: `300`

### Collection store

- key: `col:{nanoid}`
- persistent by default
- collection responses expose:
  - `id`
  - `name`
  - `revision`
  - `createdAt`
  - `updatedAt`
  - `items`

### Home workspace store

- key: `ws:{nanoid}`
- persistent by default
- owner-token protected
- revision checked on patch

## Security / Safety Constraints

- block localhost, RFC1918/private IPv4, local/ULA/link-local IPv6, and internal hostnames
- reject unsupported schemes
- reject oversized upstream HTML responses
- avoid direct component imports from server-only modules
- do not treat saved collections as permission to re-scrape on every render

## Detection Scoring

| Signal | Points |
| --- | --- |
| Known dynamic domain/service | +40 |
| API route pattern | +35 |
| CDN transform params | +30 |
| Dynamic query params | +25 |
| Content-addressable hash | +20 |
| Static file path | -20 |

Thresholds:

- `>= 50` → `Dynamic`
- `30–49` → `Build-time`
- `1–29` → `Static`
- `0` → `Unknown`

## Env Vars

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
KV_REST_API_URL=
KV_REST_API_TOKEN=
MICROLINK_API_KEY=
```

Notes:

- Upstash vars are optional only in local dev because the app falls back to an in-memory cache.
- Production and Vercel deployments should be treated as Redis-required.
- The app supports both raw Upstash env names and Vercel KV env names.
- `MICROLINK_API_KEY` is optional, but helps tier-2 reliability and rate limits.

## Testing

- `npm test` runs Vitest
- current tests cover:
  - URL normalization/parsing
  - public URL policy guards
  - collection revision conflict behavior

## Current Gotchas

- `routeTree.gen.ts` is generated; do not hand-edit it.
- `.env.example` is the env template; do not rely on checked-in `.env.local` values for deployment.
- If a collection item has stored `ogData`, the UI should use it before trying any live query.
- If local fetching “fails everywhere”, check whether the issue is upstream network access rather than Microlink itself.
