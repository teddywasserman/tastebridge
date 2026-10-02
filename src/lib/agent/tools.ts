// Agent tools. Each tool wraps one Qloo capability and records what it learned
// in a TasteSession, so the final plan can be validated against real evidence
// (the model only ever references entity ids it has actually seen).

import { City, getCity, nearestNeighbourhood } from "../cities";
import { QlooClient } from "../qloo/client";
import type { Entity, Match, NeighbourhoodFit, PlanDay, TastePlan, Tag } from "../types";

export interface Concept { id: string; label: string; tags: Tag[] }

export class TasteSession {
  entities = new Map<string, Entity>();
  sources = new Map<string, Entity>();
  concepts = new Map<string, Concept>();
  equivalents = new Map<string, Entity[]>();
  extras: Entity[] = [];
  neighbourhoods: NeighbourhoodFit[] = [];
  plan?: TastePlan;
  readonly city: City;

  constructor(public client: QlooClient, public fromCity: string, toCity: string, public llm: string) {
    const c = getCity(toCity);
    if (!c) throw new Error(`Unsupported target city: ${toCity}`);
    this.city = c;
  }

  remember(e: Entity): Entity {
    if (e.lat !== undefined && e.lon !== undefined && e.city?.toLowerCase() === this.city.name.toLowerCase()) {
      const { hood, km } = nearestNeighbourhood(this.city, e.lat, e.lon);
      if (km < 3) e.neighbourhood = hood.name;
    }
    const prev = this.entities.get(e.id);
    const merged = prev ? { ...prev, ...e, tags: e.tags.length ? e.tags : prev.tags } : e;
    this.entities.set(e.id, merged);
    return merged;
  }

  profileEntityIds(): string[] { return [...this.sources.keys()].filter((id) => !id.startsWith("concept:")); }
  profileTagIds(): string[] { return [...new Set([...this.concepts.values()].flatMap((c) => c.tags.map((t) => t.id)))].slice(0, 10); }
}

const brief = (e: Entity) => ({
  id: e.id, name: e.name, type: e.type.replace("urn:entity:", ""), address: e.address,
  neighbourhood: e.neighbourhood, affinity: e.affinity !== undefined ? Number(e.affinity.toFixed(3)) : undefined,
  tags: e.tags.slice(0, 8).map((t) => t.name),
});

export function sharedTags(a: Entity, b: Entity): string[] {
  const names = new Set(a.tags.map((t) => t.name.toLowerCase()));
  const ids = new Set(a.tags.map((t) => t.id));
  return b.tags.filter((t) => ids.has(t.id) || names.has(t.name.toLowerCase())).map((t) => t.name);
}

// ---------------- tool declarations (Gemini function-calling schema) ----------------

export const TOOL_DECLARATIONS = [
  {
    name: "search_entities",
    description: "Resolve something the user loves (a venue, artist, etc.) to Qloo entities via Qloo /search. Returns candidates with ids and taste tags.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name to look up, e.g. 'Drop Coffee'" },
        city: { type: "string", description: "City the thing is in (the user's current city), if it is a place" },
      },
      required: ["query"],
    },
  },
  {
    name: "lookup_tags",
    description: "Find Qloo taste tag ids for a free-text concept (e.g. 'natural wine', 'sauna') via Qloo /v2/tags. Use when a love is a habit or vibe rather than a named entity.",
    parameters: { type: "object", properties: { concept: { type: "string" } }, required: ["concept"] },
  },
  {
    name: "find_equivalents",
    description: "Find the taste-equivalent places in the target city for ONE source the user loves (Qloo /v2/insights, filter.type=urn:entity:place, signal.interests.entities, feature.explainability). Pass either source_entity_id (from search_entities) or concept + tag_ids (from lookup_tags).",
    parameters: {
      type: "object",
      properties: {
        source_entity_id: { type: "string" },
        concept: { type: "string", description: "Label of a free-text love, when there is no entity" },
        tag_ids: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "find_taste_matches",
    description: "Broader recommendations in the target city for the user's whole taste profile (all resolved sources and concept tags combined). Use once, after the equivalents.",
    parameters: { type: "object", properties: { take: { type: "integer", description: "How many places (max 15)" } } },
  },
  {
    name: "rank_neighbourhoods",
    description: "Rank the target city's neighbourhoods by fit with the user's taste, using a Qloo affinity heatmap (filter.type=urn:heatmap) plus where the matched places are.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "submit_plan",
    description: "Finish: submit the then-to-now matches and the first-week plan. Only use entity ids returned by earlier tools.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "2-3 sentences: the user's taste in a nutshell and where they should start in the new city." },
        matches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source_id: { type: "string", description: "source entity id or concept:<label> id" },
              target_id: { type: "string" },
              why: { type: "string", description: "One sentence grounded in the shared tags / affinity." },
            },
            required: ["source_id", "target_id", "why"],
          },
        },
        week: {
          type: "array",
          description: "7 days, Mon..Sun, 1-3 items each, mixing matches and other recommendations; set realistic times.",
          items: {
            type: "object",
            properties: {
              day: { type: "string" },
              title: { type: "string" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: { time: { type: "string" }, entity_id: { type: "string" }, note: { type: "string" } },
                  required: ["time", "entity_id", "note"],
                },
              },
            },
            required: ["day", "title", "items"],
          },
        },
      },
      required: ["summary", "matches", "week"],
    },
  },
] as const;

export const TOOL_LABELS: Record<string, (a: Record<string, unknown>, s: TasteSession) => string> = {
  search_entities: (a) => `Qloo /search · “${a.query}”`,
  lookup_tags: (a) => `Qloo /v2/tags · “${a.concept}”`,
  find_equivalents: (a, s) => `Qloo /v2/insights · equivalents of ${s.entities.get(String(a.source_entity_id))?.name ?? a.concept ?? a.source_entity_id} in ${s.city.name}`,
  find_taste_matches: (_a, s) => `Qloo /v2/insights · whole-profile picks in ${s.city.name}`,
  rank_neighbourhoods: (_a, s) => `Qloo heatmap · neighbourhood fit in ${s.city.name}`,
  submit_plan: () => "Composing then → now matches and first-week plan",
};

// ---------------- tool implementations ----------------

export interface ToolOutput { result: unknown; summary: string }

export async function runTool(name: string, args: Record<string, unknown>, s: TasteSession): Promise<ToolOutput> {
  switch (name) {
    case "search_entities": return searchEntities(s, String(args.query ?? ""), args.city ? String(args.city) : s.fromCity);
    case "lookup_tags": return lookupTags(s, String(args.concept ?? ""));
    case "find_equivalents": return findEquivalents(s, args);
    case "find_taste_matches": return findTasteMatches(s, Number(args.take ?? 12));
    case "rank_neighbourhoods": return rankNeighbourhoods(s);
    case "submit_plan": return submitPlan(s, args);
    default: return { result: { error: `unknown tool ${name}` }, summary: `Unknown tool ${name}` };
  }
}

export async function searchEntities(s: TasteSession, query: string, city?: string): Promise<ToolOutput> {
  const found = (await s.client.search(query, { take: 5, city })).map((e) => s.remember(e));
  return {
    result: { candidates: found.map(brief) },
    summary: found.length ? `${found.length} candidate${found.length > 1 ? "s" : ""}; best: ${found[0].name}` : "No entity found",
  };
}

export async function lookupTags(s: TasteSession, concept: string): Promise<ToolOutput> {
  const tags = await s.client.findTags(concept, 6);
  if (tags.length) {
    const id = `concept:${concept.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    s.concepts.set(id, { id, label: concept, tags });
  }
  return {
    result: { concept_id: tags.length ? `concept:${concept.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : null, tags: tags.map((t) => ({ id: t.id, name: t.name })) },
    summary: tags.length ? `Tags: ${tags.slice(0, 4).map((t) => t.name).join(", ")}` : "No matching tags",
  };
}

export async function findEquivalents(s: TasteSession, args: Record<string, unknown>): Promise<ToolOutput> {
  let source: Entity | undefined;
  let tagIds: string[] | undefined;
  if (args.source_entity_id) {
    source = s.entities.get(String(args.source_entity_id));
    if (!source) return { result: { error: "Unknown source_entity_id; call search_entities first." }, summary: "Unknown source id" };
  } else {
    const rawLabel = String(args.concept ?? "something you love");
    const label = rawLabel.startsWith("concept:") ? s.concepts.get(rawLabel)?.label ?? rawLabel.slice(8).replace(/-/g, " ") : rawLabel;
    const id = `concept:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const known = s.concepts.get(id);
    const ids = (args.tag_ids as string[] | undefined)?.length ? (args.tag_ids as string[]) : known?.tags.map((t) => t.id) ?? [];
    if (!ids.length) return { result: { error: "Need tag_ids from lookup_tags for a concept." }, summary: "No tags for concept" };
    const tags = known?.tags ?? ids.map((t) => ({ id: t, name: t.split(":").pop()!.replace(/_/g, " "), kind: "keyword" as const }));
    s.concepts.set(id, { id, label, tags });
    source = { id, name: label, type: "concept", tags };
    tagIds = ids;
  }
  s.sources.set(source.id, source);
  const category = source.type === "urn:entity:place" ? source.tags.find((t) => t.kind === "category") : undefined;
  const ask = (filter?: string[]) => s.client.placeInsights({
    city: s.city.name,
    entityIds: tagIds ? undefined : [source!.id],
    tagIds,
    filterTags: filter,
    take: 6,
  });
  let found = await ask(category ? [category.id] : undefined);
  if (!found.length && category) found = await ask(undefined);
  found = found.map((e) => s.remember(e));
  s.equivalents.set(source.id, found);
  const top = found[0];
  return {
    result: {
      source: { id: source.id, name: source.name },
      equivalents: found.map((e) => ({ ...brief(e), shared_tags: sharedTags(source!, e) })),
    },
    summary: top ? `${found.length} places; top: ${top.name} (${Math.round((top.affinity ?? 0) * 100)}% affinity)` : "No equivalents found",
  };
}

export async function findTasteMatches(s: TasteSession, take: number): Promise<ToolOutput> {
  const found = (await s.client.placeInsights({
    city: s.city.name,
    entityIds: s.profileEntityIds().slice(0, 10),
    tagIds: s.profileTagIds(),
    take: Math.min(Math.max(take, 5), 15),
  })).map((e) => s.remember(e));
  const used = new Set([...s.equivalents.values()].flatMap((l) => l.slice(0, 1).map((e) => e.id)));
  s.extras = found.filter((e) => !used.has(e.id));
  return {
    result: { places: found.map(brief) },
    summary: `${found.length} profile-wide picks (${s.extras.length} new)`,
  };
}

export async function rankNeighbourhoods(s: TasteSession): Promise<ToolOutput> {
  let cells: { lat: number; lon: number; affinity: number }[] = [];
  try {
    cells = await s.client.heatmap({ city: s.city.name, entityIds: s.profileEntityIds().slice(0, 10), tagIds: s.profileTagIds() });
  } catch {
    cells = [];
  }
  const byHood = new Map<string, number[]>();
  for (const c of cells) {
    const { hood, km } = nearestNeighbourhood(s.city, c.lat, c.lon);
    if (km > 2.5) continue;
    byHood.set(hood.name, [...(byHood.get(hood.name) ?? []), c.affinity]);
  }
  const placed = [...new Map([...[...s.equivalents.values()].flatMap((l) => l.slice(0, 2)), ...s.extras].map((e) => [e.id, e])).values()];
  const counts = new Map<string, Entity[]>();
  for (const e of placed) if (e.neighbourhood) counts.set(e.neighbourhood, [...(counts.get(e.neighbourhood) ?? []), e]);
  const maxCount = Math.max(1, ...[...counts.values()].map((l) => l.length));
  const rows = s.city.neighbourhoods.map((h) => {
    const aff = (byHood.get(h.name) ?? []).sort((a, b) => b - a).slice(0, 3);
    const heat = aff.length ? aff.reduce((a, b) => a + b, 0) / aff.length : 0;
    const here = counts.get(h.name) ?? [];
    const raw = cells.length ? 0.6 * heat + 0.4 * (here.length / maxCount) : here.length / maxCount;
    return { h, raw, here, heat };
  });
  const max = Math.max(...rows.map((r) => r.raw), 1e-9);
  s.neighbourhoods = rows
    .filter((r) => r.raw > 0)
    .sort((a, b) => b.raw - a.raw)
    .slice(0, 6)
    .map((r) => ({
      name: r.h.name,
      score: Math.round(40 + 56 * (r.raw / max)),
      lat: r.h.lat,
      lon: r.h.lon,
      highlights: r.here.slice(0, 4).map((e) => e.name),
      why: `${r.h.vibe}. ${r.here.length ? `${r.here.length} of your matches ${r.here.length === 1 ? "is" : "are"} here` : "Strong taste affinity in the heatmap"}${cells.length ? `; heatmap affinity ${Math.round(r.heat * 100)}%.` : "."}`,
    }));
  return {
    result: { neighbourhoods: s.neighbourhoods.map(({ name, score, highlights, why }) => ({ name, score, highlights, why })) },
    summary: s.neighbourhoods.length ? `Best fit: ${s.neighbourhoods.slice(0, 3).map((n) => `${n.name} ${n.score}`).join(", ")}` : "No neighbourhood signal",
  };
}

// ---------------- plan assembly ----------------

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildMatches(s: TasteSession, picks: { source_id: string; target_id: string; why: string }[]): Match[] {
  const out: Match[] = [];
  for (const [sid, list] of s.equivalents) {
    const source = s.sources.get(sid);
    if (!source || !list.length) continue;
    const pick = picks.find((p) => p.source_id === sid && s.entities.has(p.target_id));
    const target = pick ? s.entities.get(pick.target_id)! : list[0];
    const shared = sharedTags(source, target);
    out.push({
      source,
      target,
      sharedTags: shared,
      affinity: target.affinity ?? 0,
      why: ((target.affinity ?? 0) < 0.5 ? "Weak signal — treat as a starting point. " : "") + (pick?.why || defaultWhy(source, target, shared)),
      alternatives: list.filter((e) => e.id !== target.id).slice(0, 2),
    });
  }
  return out;
}

export function defaultWhy(source: Entity, target: Entity, shared: string[]): string {
  const ex = target.explain?.[source.id];
  if (shared.length) return `Shares ${shared.slice(0, 3).join(", ")} with ${source.name}${ex ? ` (explainability score ${ex.toFixed(2)})` : ""}.`;
  return `Qloo affinity ${Math.round((target.affinity ?? 0) * 100)}% for people who love ${source.name}.`;
}

function timeFor(e: Entity): string {
  const cat = e.tags.find((t) => t.kind === "category")?.id ?? "";
  if (/cafe|bakery/.test(cat)) return "09:00";
  if (/market|park|garden/.test(cat)) return "11:00";
  if (/museum|gallery|bookshop/.test(cat)) return "14:00";
  if (/restaurant|wine_bar/.test(cat)) return "19:30";
  if (/cinema/.test(cat)) return "20:30";
  if (/jazz|music|bar|dance|beer/.test(cat)) return "21:30";
  if (/nightclub/.test(cat)) return "23:59";
  return "16:00";
}

export function defaultWeek(s: TasteSession, matches: Match[]): PlanDay[] {
  const pool = [...matches.map((m) => m.target), ...s.extras].filter((e, i, a) => a.findIndex((x) => x.id === e.id) === i);
  const day = (i: number) => pool.filter((_, j) => j % 7 === i);
  return DAYS.map((d, i) => {
    const items = day(i).slice(0, 2).sort((a, b) => timeFor(a).localeCompare(timeFor(b)));
    return {
      day: d,
      title: items.length ? `${items[0].neighbourhood ?? s.city.name}${items[1] ? ` → ${items[1].neighbourhood ?? ""}` : ""}` : "Free day",
      items: items.map((e) => ({ time: timeFor(e), entity: e, note: e.tags.slice(1, 3).map((t) => t.name).join(" · ") })),
    };
  }).filter((d) => d.items.length);
}

export function submitPlan(s: TasteSession, args: Record<string, unknown>): ToolOutput {
  const picks = (args.matches as { source_id: string; target_id: string; why: string }[] | undefined) ?? [];
  const matches = buildMatches(s, picks);
  const weekIn = (args.week as { day: string; title: string; items: { time: string; entity_id: string; note: string }[] }[] | undefined) ?? [];
  let week: PlanDay[] = weekIn
    .map((d) => ({
      day: d.day,
      title: d.title,
      items: (d.items ?? []).filter((it) => s.entities.has(it.entity_id)).map((it) => ({ time: it.time, entity: s.entities.get(it.entity_id)!, note: it.note })),
    }))
    .filter((d) => d.items.length);
  const dropped = weekIn.reduce((n, d) => n + (d.items?.length ?? 0), 0) - week.reduce((n, d) => n + d.items.length, 0);
  if (week.length < 4) week = defaultWeek(s, matches);
  const summary = String(args.summary ?? "").trim() ||
    `Your taste leans ${topTagNames(s).join(", ")}. Start in ${s.neighbourhoods[0]?.name ?? s.city.name}.`;
  s.plan = {
    fromCity: s.fromCity,
    toCity: s.city.name,
    summary,
    sources: [...s.sources.values()],
    matches,
    neighbourhoods: s.neighbourhoods,
    week,
    extras: s.extras,
    provenance: { qlooCalls: s.client.stats.calls, qlooMode: s.client.mode, llm: s.llm },
  };
  return {
    result: { ok: true, matches: matches.length, days: week.length, dropped_unknown_ids: dropped },
    summary: `${matches.length} matches, ${week.length}-day plan${dropped > 0 ? ` (${dropped} unverified items dropped)` : ""}`,
  };
}

export function topTagNames(s: TasteSession): string[] {
  const count = new Map<string, number>();
  for (const e of s.sources.values()) for (const t of e.tags) if (t.kind === "keyword") count.set(t.name, (count.get(t.name) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
}
