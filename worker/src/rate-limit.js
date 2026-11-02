const buckets = new Map();

export function resetRateLimit() {
  buckets.clear();
}

export function allowRequest(ip, bucket, limit, windowMs, now = Date.now()) {
  const key = `${bucket}:${ip || 'unknown'}`;
  let entry = buckets.get(key);
  if (!entry || now - entry.start >= windowMs) entry = { start: now, count: 0 };
  entry.count += 1;
  buckets.set(key, entry);
  if (buckets.size > 5000) buckets.clear();
  return entry.count <= limit;
}

export const LIMITS = {
  extract: { limit: 8, windowMs: 10 * 60 * 1000 },
  plan: { limit: 8, windowMs: 10 * 60 * 1000 },
  roleplay: { limit: 30, windowMs: 10 * 60 * 1000 },
  grade: { limit: 20, windowMs: 10 * 60 * 1000 }
};
