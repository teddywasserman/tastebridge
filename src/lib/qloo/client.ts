// Typed Qloo client. Live mode calls https://hackathon.api.qloo.com with the
// X-Api-Key header; mock mode (no QLOO_API_KEY) serves fixture JSON with the
// same shapes. Both paths share the response cache, rate limiter and parsers.

import type { Entity, Tag } from "../types";
import { mockQloo } from "./mock";

export const QLOO_BASE_URL = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";

export type QlooMode = "live" | "mock";
export function qlooMode(): QlooMode {
  return process.env.QLOO_API_KEY ? "live" : "mock";
}

type Params = Record<string, string | number | boolean | string[] | undefined>;

// ---------- cache (module-level, survives warm serverless invocations) ----------
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; value: unknown }>();

function cacheGet(key: string): unknown | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(key); return undefined; }
  cache.delete(key); cache.set(key, hit); // LRU bump
  return hit.value;
}
function cacheSet(key: string, value: unknown) {
  cache.set(key, { at: Date.now(), value });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

// ---------- outbound rate limiter (token bucket) ----------
const RATE_PER_SEC = Number(process.env.QLOO_RATE_PER_SEC || 4);
let tokens = RATE_PER_SEC;
let last = Date.now();
async function takeToken(): Promise<void> {
  for (;;) {
    const now = Date.now();
    tokens = Math.min(RATE_PER_SEC, tokens + ((now - last) / 1000) * RATE_PER_SEC);
    last = now;
    if (tokens >= 1) { tokens -= 1; return; }
    await new Promise((r) => setTimeout(r, Math.ceil(((1 - tokens) / RATE_PER_SEC) * 1000)));
  }
}

export class QlooError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

function toQuery(params: Params): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
    out[k] = Array.isArray(v) ? v.join(",") : String(v);
  }
  return out;
}

export interface CallStats { calls: number; cacheHits: number }

export class QlooClient {
  stats: CallStats = { calls: 0, cacheHits: 0 };
  readonly mode: QlooMode;
  constructor(private apiKey = process.env.QLOO_API_KEY) {
    this.mode = apiKey ? "live" : "mock";
  }

  async get(path: string, params: Params): Promise<unknown> {
    const query = toQuery(params);
    const qs = new URLSearchParams(Object.entries(query).sort(([a], [b]) => a.localeCompare(b))).toString();
    const key = `${this.mode}:${path}?${qs}`;
    this.stats.calls++;
    const hit = cacheGet(key);
    if (hit !== undefined) { this.stats.cacheHits++; return hit; }
    let value: unknown;
    if (this.mode === "mock") {
      value = mockQloo(path, query);
    } else {
      value = await this.fetchLive(path, qs);
    }
    cacheSet(key, value);
    return value;
  }

  private async fetchLive(path: string, qs: string, attempt = 0): Promise<unknown> {
    await takeToken();
    const res = await fetch(`${QLOO_BASE_URL}${path}?${qs}`, {
      headers: { "X-Api-Key": this.apiKey!, accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      return this.fetchLive(path, qs, attempt + 1);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new QlooError(`Qloo ${path} failed (${res.status}): ${body.slice(0, 200)}`, res.status);
    }
    return res.json();
  }

  // ---------- high-level endpoints ----------

  /** GET /search — resolve a name to Qloo entities. */
  async search(query: string, opts: { types?: string[]; take?: number; city?: string } = {}): Promise<Entity[]> {
    const raw = await this.get("/search", {
      query,
      types: opts.types,
      take: opts.take ?? 5,
      ...(this.mode === "mock" && opts.city ? { "filter.location.query": opts.city } : {}),
    });
    return extractEntities(raw).map(normaliseEntity);
  }

  /** GET /v2/tags — find tag ids for a free-text concept ("natural wine"). */
  async findTags(query: string, take = 8): Promise<Tag[]> {
    const raw = (await this.get("/v2/tags", { "filter.query": query, take })) as { results?: { tags?: RawTag[] } };
    return (raw.results?.tags ?? []).map(normaliseTag);
  }

  /** GET /v2/insights filter.type=urn:entity:place in a city, with explainability. */
  async placeInsights(opts: { city: string; entityIds?: string[]; tagIds?: string[]; filterTags?: string[]; take?: number }): Promise<Entity[]> {
    const raw = await this.get("/v2/insights", {
      "filter.type": "urn:entity:place",
      "filter.location.query": opts.city,
      "signal.interests.entities": opts.entityIds,
      "signal.interests.tags": opts.tagIds,
      "filter.tags": opts.filterTags,
      "feature.explainability": true,
      take: opts.take ?? 10,
    });
    return extractEntities(raw).map((e) => ({ ...normaliseEntity(e), city: opts.city }));
  }

  /** GET /v2/insights filter.type=urn:heatmap — taste affinity by area. */
  async heatmap(opts: { city: string; entityIds?: string[]; tagIds?: string[] }): Promise<HeatCell[]> {
    const raw = (await this.get("/v2/insights", {
      "filter.type": "urn:heatmap",
      "filter.location.query": opts.city,
      "signal.interests.entities": opts.entityIds,
      "signal.interests.tags": opts.tagIds,
    })) as { results?: { heatmap?: RawHeat[] } };
    return (raw.results?.heatmap ?? [])
      .map((c) => ({
        lat: Number(c.location?.latitude ?? c.location?.lat),
        lon: Number(c.location?.longitude ?? c.location?.lon),
        affinity: Number(c.query?.affinity ?? c.query?.affinity_rank ?? 0),
        popularity: Number(c.query?.popularity ?? 0),
      }))
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
  }
}

export interface HeatCell { lat: number; lon: number; affinity: number; popularity: number }

// ---------- parsing (defensive: tolerate small shape differences) ----------

interface RawTag { id?: string; tag_id?: string; name?: string; type?: string }
interface RawHeat { location?: { latitude?: number; longitude?: number; lat?: number; lon?: number }; query?: { affinity?: number; affinity_rank?: number; popularity?: number } }
interface RawEntity {
  entity_id?: string; id?: string; name?: string; subtype?: string; type?: string; types?: string[];
  popularity?: number; location?: { lat?: number; lon?: number; latitude?: number; longitude?: number };
  properties?: { address?: string; geocode?: { name?: string; latitude?: number; longitude?: number }; latitude?: number; longitude?: number };
  tags?: RawTag[];
  query?: { affinity?: number; explainability?: Record<string, { entity_id?: string; score?: number }[]> | unknown };
}

export function extractEntities(raw: unknown): RawEntity[] {
  const r = raw as { results?: unknown };
  if (Array.isArray(r?.results)) return r.results as RawEntity[];
  const ents = (r?.results as { entities?: RawEntity[] } | undefined)?.entities;
  return Array.isArray(ents) ? ents : [];
}

export function normaliseTag(t: RawTag): Tag {
  const id = t.tag_id ?? t.id ?? "";
  return { id, name: t.name ?? id.split(":").pop() ?? id, kind: id.includes(":genre:place") || t.type?.includes("genre:place") ? "category" : "keyword" };
}

export function normaliseEntity(e: RawEntity): Entity {
  const type = e.subtype ?? e.types?.[0] ?? e.type ?? "urn:entity";
  const lat = e.location?.lat ?? e.location?.latitude ?? e.properties?.geocode?.latitude ?? e.properties?.latitude;
  const lon = e.location?.lon ?? e.location?.longitude ?? e.properties?.geocode?.longitude ?? e.properties?.longitude;
  const explain: Record<string, number> = {};
  const ex = e.query?.explainability as Record<string, { entity_id?: string; score?: number }[]> | undefined;
  const sigs = ex?.["signal.interests.entities"];
  if (Array.isArray(sigs)) for (const s of sigs) if (s.entity_id) explain[s.entity_id] = Number(s.score ?? 0);
  // de-duplicate tags and keep at most 24
  const seen = new Set<string>();
  const tags = (e.tags ?? []).map(normaliseTag).filter((t) => t.id && !seen.has(t.id) && seen.add(t.id)).slice(0, 24);
  return {
    id: e.entity_id ?? e.id ?? "",
    name: e.name ?? "Unknown",
    type,
    address: e.properties?.address,
    city: e.properties?.geocode?.name,
    lat: typeof lat === "number" ? lat : undefined,
    lon: typeof lon === "number" ? lon : undefined,
    tags,
    popularity: e.popularity,
    affinity: e.query?.affinity,
    explain: Object.keys(explain).length ? explain : undefined,
  };
}
