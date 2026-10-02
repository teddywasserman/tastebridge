import { describe, expect, it } from "vitest";
import { QlooClient, extractEntities, normaliseEntity } from "../src/lib/qloo/client";
import { mockQloo } from "../src/lib/qloo/mock";

describe("mock Qloo client", () => {
  const q = new QlooClient(undefined);

  it("runs in mock mode without a key", () => expect(q.mode).toBe("mock"));

  it("resolves names via /search", async () => {
    const r = await q.search("Drop Coffee", { city: "Stockholm" });
    expect(r[0].name).toBe("Drop Coffee");
    expect(r[0].tags.some((t) => t.kind === "category")).toBe(true);
  });

  it("returns ranked place insights with explainability in the target city", async () => {
    const [src] = await q.search("Fasching");
    const recs = await q.placeInsights({ city: "Lisbon", entityIds: [src.id], take: 5 });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].name).toBe("Hot Clube de Portugal");
    expect(recs[0].explain?.[src.id]).toBeGreaterThan(0);
    for (let i = 1; i < recs.length; i++) expect(recs[i - 1].affinity!).toBeGreaterThanOrEqual(recs[i].affinity!);
  });

  it("finds tags for free-text concepts", async () => {
    const tags = await q.findTags("natural wine");
    expect(tags.map((t) => t.name)).toContain("natural wine");
  });

  it("returns a normalised heatmap", async () => {
    const [src] = await q.search("Drop Coffee");
    const cells = await q.heatmap({ city: "Berlin", entityIds: [src.id] });
    expect(cells.length).toBeGreaterThan(10);
    expect(Math.max(...cells.map((c) => c.affinity))).toBeCloseTo(1, 3);
  });

  it("caches identical requests", async () => {
    const before = q.stats.cacheHits;
    await q.search("Bio Rio");
    await q.search("Bio Rio");
    expect(q.stats.cacheHits).toBe(before + 1);
  });
});

describe("response normalisation", () => {
  it("parses /v2/insights-shaped JSON", () => {
    const raw = mockQloo("/v2/insights", { "filter.type": "urn:entity:place", "filter.location.query": "Toronto", take: "3", "feature.explainability": "true" });
    const ents = extractEntities(raw).map(normaliseEntity);
    expect(ents).toHaveLength(3);
    expect(ents[0].lat).toBeTypeOf("number");
    expect(ents[0].type).toBe("urn:entity:place");
  });

  it("tolerates alternative shapes", () => {
    const e = normaliseEntity({ id: "x", name: "Y", types: ["urn:entity:place"], location: { latitude: 1, longitude: 2 }, tags: [{ tag_id: "urn:tag:genre:place:cafe", name: "Café" }] });
    expect(e).toMatchObject({ id: "x", lat: 1, lon: 2 });
    expect(e.tags[0].kind).toBe("category");
  });
});
