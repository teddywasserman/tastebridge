// Per-IP sliding-window limiter for agent runs. In-memory per serverless
// instance: a cheap guard so judges can't burn the Qloo / Gemini quota.
const hits = new Map<string, number[]>();

export function allow(ip: string, limit = Number(process.env.RUNS_PER_10_MIN || 8), windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) { hits.set(ip, recent); return false; }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
