import { Redis } from "@upstash/redis";

// On Vercel, connecting an Upstash Redis database sets these variables automatically.
// Locally they're usually absent, and the app falls back to a JSON file and memory.
const configured = Boolean(
  (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN),
);

export const redis = configured ? Redis.fromEnv() : null;
