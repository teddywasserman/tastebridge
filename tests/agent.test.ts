import { describe, expect, it } from "vitest";
import { runAgent } from "../src/lib/agent/run";
import type { AgentEvent } from "../src/lib/types";

describe("autopilot agent (no LLM, mock Qloo)", () => {
  it("produces a validated plan from loves", async () => {
    const events: AgentEvent[] = [];
    await runAgent({ loves: ["Drop Coffee", "Fasching", "sunday flea markets"], fromCity: "Stockholm", toCity: "Lisbon" }, (e) => events.push(e), { useLlm: false });
    const result = events.find((e) => e.type === "result");
    expect(result).toBeDefined();
    const plan = (result as Extract<AgentEvent, { type: "result" }>).plan;
    expect(plan.matches.length).toBe(3);
    expect(plan.matches[0].target.name).toBe("Fábrica Coffee Roasters");
    expect(plan.neighbourhoods.length).toBeGreaterThan(2);
    expect(plan.week.length).toBeGreaterThanOrEqual(4);
    const known = new Set(events.filter((e) => e.type === "tool_call").length ? plan.week.flatMap((d) => d.items.map((i) => i.entity.id)) : []);
    expect(known.size).toBeGreaterThan(3);
    expect(events.at(-1)?.type).toBe("done");
  });
});

describe("concept handling", () => {
  it("accepts a concept id in place of the label", async () => {
    const { TasteSession, lookupTags, findEquivalents } = await import("../src/lib/agent/tools");
    const { QlooClient } = await import("../src/lib/qloo/client");
    const s = new TasteSession(new QlooClient(undefined), "Gothenburg", "Toronto", "test");
    await lookupTags(s, "natural wine");
    await findEquivalents(s, { concept: "concept:natural-wine" });
    expect([...s.sources.values()][0].name).toBe("natural wine");
  });
});
