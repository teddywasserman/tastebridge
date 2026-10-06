// Parsers against real hackathon.api.qloo.com responses (trimmed copies
// recorded on 2026-10-06 during the go/no-go probe).
import { describe, expect, it, vi, afterEach } from "vitest";
import { QlooClient, extractEntities, normaliseEntity, normaliseTag } from "../src/lib/qloo/client";
import search from "./fixtures/live_search_drop_coffee.json";
import insights from "./fixtures/live_insights_lisbon.json";
import heat from "./fixtures/live_heatmap_lisbon.json";
import tags from "./fixtures/live_tags_natural_wine.json";

describe("live /search shape", () => {
  const ents = extractEntities(search).map(normaliseEntity);
  it("reads results[] with location.lat/lon and geocode", () => {
    const sto = ents.find((e) => e.name === "Drop Coffee Roasters")!;
    expect(sto.type).toBe("urn:entity:place");
    expect(sto.lat).toBeCloseTo(59.3169, 3);
    expect(sto.city).toBe("Stockholm Municipality");
    expect(sto.qlooNeighbourhood).toBe("Södermalm");
  });
  it("puts the primary genre first and drops logistics tags", () => {
    const sto = ents.find((e) => e.name === "Drop Coffee Roasters")!;
    expect(sto.primaryGenre?.id).toBe("urn:tag:genre:place:restaurant:coffee_shop");
    expect(sto.tags[0].id).toBe(sto.primaryGenre!.id);
    expect(sto.tags.some((t) => /payments|accessibility|service_type/.test(t.id))).toBe(false);
    expect(sto.tags.map((t) => t.name)).toContain("Industrial");
  });
});

describe("live /v2/insights shape", () => {
  const ents = extractEntities(insights).map(normaliseEntity);
  it("reads results.entities with affinity and explainability", () => {
    expect(ents.length).toBe(4);
    expect(ents[0].affinity).toBeGreaterThan(0.8);
    expect(ents[0].explain?.["64BF58F0-9C5D-47C6-B759-5ABD37F708AD"]).toBe(1);
    expect(ents[0].city).toBe("Lisbon");
  });
});

describe("live heatmap and tags", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("normalises heatmap cells via the client", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(heat), { status: 200 })));
    const cells = await new QlooClient("test-key").heatmap({ city: "Lisbon", entityIds: ["x-heat"] });
    expect(cells.length).toBe(5);
    expect(cells[0]).toMatchObject({ lat: 38.72406, lon: -9.135132, affinity: 1 });
  });
  it("reads /v2/tags ids", () => {
    const t = (tags as { results: { tags: { id: string }[] } }).results.tags.map(normaliseTag);
    expect(t[0].id).toBe("urn:tag:resy:collection:place:natural_wine");
    expect(t.find((x) => x.id === "urn:tag:genre:place:restaurant:natural_wine")?.kind).toBe("category");
  });
  it("filters out-of-city results and duplicate names in placeInsights", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(insights), { status: 200 })));
    const r = await new QlooClient("test-key").placeInsights({ city: "Lisbon", center: { lat: 38.7139, lon: -9.145 }, entityIds: ["x-dedupe"], take: 10 });
    expect(r.length).toBeGreaterThan(0);
    expect(new Set(r.map((e) => e.name.toLowerCase())).size).toBe(r.length);
  });
});
