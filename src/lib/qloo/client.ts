// Typed Qloo client. Live mode calls https://hackathon.api.qloo.com with the
// X-Api-Key header; mock mode (no QLOO_API_KEY) serves fixture JSON with the
// same shapes. Both paths share the response cache, rate limiter and parsers.

import type { Entity, Tag } from "../types";
import { mockQloo } from "./mock";
import { haversineKm } from "../cities";

/** Lodging and generic venues crowd out the cafes, bars and parks a newcomer wants. */
export const EXCLUDE_PLACE_TAGS = [
  "urn:tag:genre:place:hotel", "urn:tag:genre:place:lodging", "urn:tag:genre:place:event_venue",
  "urn:tag:genre:place:supermarket", "urn:tag:genre:place:grocery_store", "urn:tag:genre:place:gym",
];

/** Case/accent-insensitive key, so "FABRICA COFFEE ROASTERS" and "Fabrica Coffee Roasters" count once. */
export function nameKey(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

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

  /** GET /search: resolve a name to Qloo entities. With `near` (the user's
   * home city centre) places are biased to that city via filter.location; a
   * second, unbiased lookup keeps non-place entities (artists, films) reachable. */
  async search(query: string, opts: { types?: string[]; take?: number; city?: string; near?: { lat: number; lon: number } } = {}): Promise<Entity[]> {
    const take = opts.take ?? 5;
    if (this.mode === "mock" || !opts.near) {
      const raw = await this.get("/search", {
        query,
        types: opts.types,
        take,
        ...(this.mode === "mock" && opts.city ? { "filter.location.query": opts.city } : {}),
      });
      return extractEntities(raw).map(normaliseEntity);
    }
    const [local, global] = await Promise.all([
      this.get("/search", { query, types: opts.types, take, "filter.location": `${opts.near.lat},${opts.near.lon}` }).catch(() => ({ results: [] })),
      this.get("/search", { query, types: opts.types, take }).catch(() => ({ results: [] })),
    ]);
    const near = extractEntities(local).map(normaliseEntity)
      .filter((e) => e.lat === undefined || e.lon === undefined || haversineKm(e.lat, e.lon, opts.near!.lat, opts.near!.lon) < 60);
    const others = extractEntities(global).map(normaliseEntity).filter((e) => e.type !== "urn:entity:place");
    const seen = new Set<string>();
    return [...near, ...others].filter((e) => e.id && !seen.has(e.id) && seen.add(e.id)).slice(0, take);
  }

  /** GET /v2/tags — find tag ids for a free-text concept ("natural wine"). */
  async findTags(query: string, take = 8): Promise<Tag[]> {
    const raw = (await this.get("/v2/tags", {
      "filter.query": query,
      // live: only tags that describe places, so "science fiction" yields decor tags, not book genres
      ...(this.mode === "live" ? { "filter.parents.types": "urn:entity:place" } : {}),
      take,
    })) as { results?: { tags?: RawTag[] } };
    return (raw.results?.tags ?? []).map(normaliseTag);
  }

  /** GET /v2/insights filter.type=urn:entity:place in a city, with explainability.
   * Live results can include nearby towns (e.g. Cascais for Lisbon), so when the
   * city centre is known we over-fetch and keep places within `radiusKm`. */
  async placeInsights(opts: {
    city: string; center?: { lat: number; lon: number }; radiusKm?: number;
    entityIds?: string[]; tagIds?: string[]; filterTags?: string[]; excludeTags?: string[]; take?: number;
  }): Promise<Entity[]> {
    const take = opts.take ?? 10;
    const live = this.mode === "live";
    const raw = await this.get("/v2/insights", {
      "filter.type": "urn:entity:place",
      "filter.location.query": opts.city,
      "signal.interests.entities": opts.entityIds,
      "signal.interests.tags": opts.tagIds,
      "filter.tags": opts.filterTags,
      ...(live ? { "filter.exclude.tags": opts.excludeTags ?? EXCLUDE_PLACE_TAGS } : {}),
      "feature.explainability": true,
      take: live && opts.center ? Math.min(take * 2, 30) : take,
    });
    const seenNames = new Set<string>();
    return extractEntities(raw)
      .map((e) => normaliseEntity(e))
      .filter((e) => !opts.center || e.lat === undefined || e.lon === undefined ||
        haversineKm(e.lat, e.lon, opts.center.lat, opts.center.lon) <= (opts.radiusKm ?? 11))
      .filter((e) => { const k = nameKey(e.name); if (seenNames.has(k)) return false; seenNames.add(k); return true; })
      .map((e) => ({ ...e, city: opts.city }))
      .slice(0, take);
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
  properties?: {
    address?: string; description?: string; neighborhood?: string;
    geocode?: { name?: string; city?: string; latitude?: number; longitude?: number };
    latitude?: number; longitude?: number;
    primary_genre?: { id?: string; name?: string };
    image?: { url?: string };
  };
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
  const type = t.type ?? id.replace(/:[^:]+$/, "");
  const name = t.name ?? id.split(":").pop()?.replace(/_/g, " ") ?? id;
  return { id, name, type, kind: id.includes(":genre:place") || type.includes("genre:place") ? "category" : "keyword" };
}

/** Live place tags include logistics (payments, wheelchair access, takeout).
 * These say nothing about taste, so they are dropped; the rest are ordered so
 * the most characterful tag families come first. */
const NOISE_TAG_TYPES = /:(service_type|service_options|payments|accessibility|amenities|amenity|pets|dining_options|age_range|planning|parking|children|crowd|popular_with|highlights|offerings|category|nearby_attraction|time_of_day_fit|visit_intent)(:|$)/;
const TAG_TYPE_ORDER = ["genre", "culinary_style", "cuisine", "ambience", "decor", "setting", "neighborhood_characteristic", "interests", "activity_type", "menu_highlight", "customer_identity", "dietary_option"];
function tagRank(t: Tag): number {
  const i = TAG_TYPE_ORDER.findIndex((k) => (t.type ?? t.id).includes(`:${k}`));
  return i === -1 ? TAG_TYPE_ORDER.length : i;
}

export function normaliseEntity(e: RawEntity): Entity {
  const type = e.subtype ?? e.types?.[0] ?? e.type ?? "urn:entity";
  const lat = e.location?.lat ?? e.location?.latitude ?? e.properties?.geocode?.latitude ?? e.properties?.latitude;
  const lon = e.location?.lon ?? e.location?.longitude ?? e.properties?.geocode?.longitude ?? e.properties?.longitude;
  const explain: Record<string, number> = {};
  const ex = e.query?.explainability as Record<string, { entity_id?: string; score?: number }[]> | undefined;
  const sigs = ex?.["signal.interests.entities"];
  if (Array.isArray(sigs)) for (const s of sigs) if (s.entity_id) explain[s.entity_id] = Number(s.score ?? 0);
  const pg = e.properties?.primary_genre;
  const primary = pg?.id ? normaliseTag({ id: pg.id, name: pg.name, type: "urn:tag:genre:place" }) : undefined;
  // keep taste-relevant tags only, de-duplicated by id and name, primary genre first, at most 24
  const seen = new Set<string>();
  const tags = [...(primary ? [primary] : []), ...(e.tags ?? []).map(normaliseTag)]
    .filter((t) => t.id && !NOISE_TAG_TYPES.test(t.type ?? t.id))
    .filter((t) => { const k = t.name.toLowerCase(); if (seen.has(t.id) || seen.has(k)) return false; seen.add(t.id); seen.add(k); return true; })
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t === primary ? -1 : b.t === primary ? 1 : tagRank(a.t) - tagRank(b.t) || a.i - b.i))
    .map(({ t }) => t)
    .slice(0, 40);
  return {
    id: e.entity_id ?? e.id ?? "",
    name: e.name ?? "Unknown",
    type,
    address: e.properties?.address,
    city: e.properties?.geocode?.city ?? e.properties?.geocode?.name,
    qlooNeighbourhood: e.properties?.neighborhood ?? (e.properties?.geocode?.city ? e.properties?.geocode?.name : undefined),
    description: e.properties?.description,
    image: e.properties?.image?.url,
    lat: typeof lat === "number" ? lat : undefined,
    lon: typeof lon === "number" ? lon : undefined,
    tags,
    primaryGenre: primary,
    popularity: e.popularity,
    affinity: e.query?.affinity,
    explain: Object.keys(explain).length ? explain : undefined,
  };
}
