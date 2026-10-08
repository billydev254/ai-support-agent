import { redis } from "./redis";

// Protects the OpenAI bill on the public demo. Limits only apply when Redis is configured.
const PER_VISITOR_PER_HOUR = 30;
const TOTAL_PER_DAY = 1000;

async function hit(key: string, windowSeconds: number) {
  const count = await redis!.incr(key);
  if (count === 1) await redis!.expire(key, windowSeconds);
  return count;
}

/** Returns a message to show the visitor if they're over a limit, otherwise null. */
export async function checkRateLimit(ip: string): Promise<string | null> {
  if (!redis) return null;
  const hour = Math.floor(Date.now() / 3_600_000);
  const day = new Date().toISOString().slice(0, 10);

  if ((await hit(`rl:ip:${ip}:${hour}`, 3600)) > PER_VISITOR_PER_HOUR) {
    return "You've sent a lot of messages — please try again in a little while, or call the clinic directly.";
  }
  if ((await hit(`rl:day:${day}`, 86400)) > TOTAL_PER_DAY) {
    return "This demo has reached its daily message limit. Please try again tomorrow.";
  }
  return null;
}
