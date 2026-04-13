# OGBoard

Inspect Open Graph metadata and images, bulk-review URLs, and save snapshot collections.

## Features

- single URL or bulk URL OG inspection
- tiered OG extraction:
  - `open-graph-scraper`
  - Microlink fallback
- dynamic/build-time/static detection heuristics
- snapshot collections stored in Redis
- autosaved home workspace drafts stored in Redis
- local in-memory cache fallback for non-production development

## Local Development

Install dependencies and run the app:

```bash
npm install
npm run dev
```

Optional local env file:

```bash
cp .env.example .env.local
```

If neither `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` nor `KV_REST_API_URL` / `KV_REST_API_TOKEN` are set locally, the app falls back to an in-memory cache. That is convenient for development, but it is not durable across server restarts.

## Environment Variables

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
KV_REST_API_URL=
KV_REST_API_TOKEN=
MICROLINK_API_KEY=
```

Production on Vercel requires Redis env vars. The Vercel KV integration commonly injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`, which are supported by the app.

## Deploying To Vercel

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. Import the repo into Vercel.
3. Add a Redis integration from the Vercel Marketplace or connect an existing Upstash Redis database.
4. Confirm one of these Redis env pairs exists in Vercel project settings:
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
   - `KV_REST_API_URL` + `KV_REST_API_TOKEN`
   - `MICROLINK_API_KEY` (optional, recommended)
5. Redeploy after adding the integration/env vars.

This app does not need a custom `vercel.json` for deployment.

## What Persists

- saved collections
- owner tokens for collections in browser storage
- home workspace drafts
- OG fetch cache and short-lived error cache

## Testing

```bash
npm test
```

## Production Build

```bash
npm run build
```
