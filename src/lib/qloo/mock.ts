// Mock Qloo API. Returns raw JSON shaped like hackathon.api.qloo.com responses
// (results.entities[], query.affinity, query.explainability, results.heatmap[])
// so the live/mock switch only changes the transport, never the parsing.

import { getCity, haversineKm } from "../cities";
import { ALL_FIXTURES, TAG_NAMES, TARGET_PLACES, FixtureEntity, fixtureHash, slugFromUrn, tagUrn } from "./fixtures";

type Params = Record<string, string>;

function rawTag(slug: string) {
  const id = tagUrn(slug);
  return { id, tag_id: id, name: TAG_NAMES[slug] ?? slug, type: id.replace(/:[^:]+$/, "") };
}

function rawEntity(e: FixtureEntity, query?: Record<string, unknown>) {
  return {
    name: e.name,
    entity_id: e.id,
    type: "urn:entity",
    subtype: e.type,
    types: [e.type],
    popularity: e.popularity,
    ...(e.lat !== undefined ? { location: { lat: e.lat, lon: e.lon, geohash: "" } } : {}),
    properties: {
      ...(e.address ? { address: `${e.address}, ${e.city}` } : {}),
      ...(e.city ? { geocode: { name: e.city } } : {}),
    },
    tags: e.tags.map(rawTag),
    ...(query ? { query } : {}),
  };
}

const list = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function search(p: Params) {
  const q = norm(p.query ?? "");
  const types = list(p.types);
  const take = Number(p.take ?? 5);
  const words = q.split(/\s+/).filter((w) => w.length > 2 && !["the", "and", "bar", "cafe"].includes(w));
  const scored = ALL_FIXTURES.filter((e) => !types.length || types.includes(e.type))
    .map((e) => {
      const name = norm(e.name);
      let s = 0;
      if (name === q) s = 3;
      else if (name.includes(q) || (q.includes(name) && name.length > 3)) s = 2;
      else if (words.length && words.every((w) => name.includes(w))) s = 1.5;
      else if (words.some((w) => name.includes(w))) s = 0.5;
      if (s > 0 && p["filter.location.query"] && e.city && norm(e.city) === norm(p["filter.location.query"])) s += 0.5;
      return { e, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.e.popularity - a.e.popularity)
    .slice(0, take);
  return { results: scored.map(({ e }) => rawEntity(e)) };
}

const SYNONYMS: Record<string, string[]> = {
  coffee: ["specialty_coffee", "cafe", "roastery"], wine: ["natural_wine", "wine_bar"], jazz: ["jazz", "jazz_club"],
  techno: ["techno", "nightclub", "electronic"], club: ["nightclub"], art: ["contemporary_art", "gallery", "museum"],
  photo: ["photography"], film: ["arthouse", "cinema"], cinema: ["cinema", "arthouse"], movie: ["cinema"],
  book: ["bookshop"], beer: ["craft_beer", "beer_bar"], brunch: ["brunch"], cozy: ["cozy"], cosy: ["cozy"],
  vintage: ["vintage", "flea_market"], market: ["market"], garden: ["garden", "park"], park: ["park"],
  rooftop: ["rooftop"], view: ["views"], music: ["live_music", "music_venue"], gig: ["live_music"],
  seafood: ["seafood"], fish: ["seafood"], pastr: ["pastries", "bakery"], cake: ["pastries"], bakery: ["bakery"],
  sauna: ["wellness", "spa"], spa: ["spa"], design: ["design"], late: ["late_night"], cocktail: ["cocktails"],
  indie: ["indie"], dance: ["dance", "dance_hall"], street: ["street_food"], vegetarian: ["vegetarian"],
  fado: ["fado"], folk: ["folk"], comic: ["comics"], magazine: ["magazines"], water: ["waterfront"],
};

function tags(p: Params) {
  const q = norm(p["filter.query"] ?? p.query ?? "");
  const take = Number(p.take ?? 8);
  const hits = new Set<string>();
  for (const [slug, name] of Object.entries(TAG_NAMES)) {
    if (q && (norm(name).includes(q) || q.includes(norm(name)) || slug.includes(q.replace(/\s+/g, "_")))) hits.add(slug);
  }
  for (const [k, slugs] of Object.entries(SYNONYMS)) if (q.includes(k)) slugs.forEach((s) => hits.add(s));
  return { results: { tags: [...hits].slice(0, take).map(rawTag) } };
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a); const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / (A.size + B.size - inter || 1);
}

function scorePlaces(p: Params) {
  const city = p["filter.location.query"] ?? "";
  const signalIds = list(p["signal.interests.entities"]);
  const signalTags = list(p["signal.interests.tags"]).map(slugFromUrn);
  const filterTags = list(p["filter.tags"]).map(slugFromUrn);
  const signals = ALL_FIXTURES.filter((e) => signalIds.includes(e.id));
  const pool = TARGET_PLACES.filter((e) => norm(e.city ?? "") === norm(city))
    .filter((e) => !filterTags.length || filterTags.some((t) => e.tags.includes(t)));
  return pool.map((e) => {
    const explain: { entity_id: string; score: number }[] = signals.map((s) => ({
      entity_id: s.id, score: Number(jaccard(e.tags, s.tags).toFixed(3)),
    }));
    const tagHit = signalTags.length ? signalTags.filter((t) => e.tags.includes(t)).length / signalTags.length : 0;
    const best = Math.max(0, ...explain.map((x) => x.score));
    const mean = explain.length ? explain.reduce((a, x) => a + x.score, 0) / explain.length : 0;
    const jitter = (fixtureHash(e.id + signalIds.join()) % 40) / 1000;
    const affinity = Math.min(0.97, 0.40 + 0.36 * best + 0.15 * mean + 0.25 * tagHit + jitter);
    return { e, affinity, explain };
  });
}

function insights(p: Params) {
  const type = p["filter.type"];
  const take = Number(p.take ?? 10);
  if (type === "urn:heatmap") return heatmap(p);
  if (type !== "urn:entity:place") return { success: true, results: { entities: [] } };
  const scored = scorePlaces(p).sort((a, b) => b.affinity - a.affinity).slice(0, take);
  const explainOn = p["feature.explainability"] === "true";
  return {
    success: true,
    results: {
      entities: scored.map(({ e, affinity, explain }) =>
        rawEntity(e, {
          affinity: Number(affinity.toFixed(4)),
          ...(explainOn ? { explainability: { "signal.interests.entities": explain.sort((a, b) => b.score - a.score) } } : {}),
        })),
    },
    duration: 42,
  };
}

function heatmap(p: Params) {
  const city = getCity(p["filter.location.query"] ?? "");
  if (!city) return { success: true, results: { heatmap: [] } };
  const scored = scorePlaces({ ...p, "filter.tags": "" });
  const cells: { location: { latitude: number; longitude: number; geohash: string }; query: { affinity: number; affinity_rank: number; popularity: number } }[] = [];
  const step = 0.006;
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const lat = city.lat + dy * step;
      const lon = city.lon + dx * step * 1.4;
      let a = 0;
      let pop = 0;
      for (const s of scored) {
        const km = haversineKm(lat, lon, s.e.lat!, s.e.lon!);
        const w = Math.exp(-(km * km) / 0.5);
        a += w * Math.pow(s.affinity, 3);
        pop += w * s.e.popularity;
      }
      if (a > 0.02) cells.push({ location: { latitude: Number(lat.toFixed(5)), longitude: Number(lon.toFixed(5)), geohash: "" }, query: { affinity: a, affinity_rank: 0, popularity: pop } });
    }
  }
  const max = Math.max(...cells.map((c) => c.query.affinity), 1e-9);
  const maxPop = Math.max(...cells.map((c) => c.query.popularity), 1e-9);
  cells.forEach((c) => { c.query.affinity = Number((c.query.affinity / max).toFixed(4)); c.query.popularity = Number((c.query.popularity / maxPop).toFixed(4)); });
  [...cells].sort((a, b) => b.query.affinity - a.query.affinity).forEach((c, i) => { c.query.affinity_rank = Number((1 - i / cells.length).toFixed(4)); });
  return { success: true, results: { heatmap: cells } };
}

function entities(p: Params) {
  const ids = list(p.entity_ids);
  return { success: true, results: ALL_FIXTURES.filter((e) => ids.includes(e.id)).map((e) => rawEntity(e)) };
}

export function mockQloo(path: string, params: Params): unknown {
  switch (path) {
    case "/search": return search(params);
    case "/v2/tags": return tags(params);
    case "/v2/insights": return insights(params);
    case "/entities": return entities(params);
    default: throw new Error(`mock: unsupported endpoint ${path}`);
  }
}
