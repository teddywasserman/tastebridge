// Records full agent runs (events + timings) into public/journeys/*.json so
// the site can replay them instantly. Usage: npx tsx scripts/bake-journeys.ts [id]
import { writeFileSync } from "node:fs";
import { runAgent } from "../src/lib/agent/run";
import type { AgentEvent } from "../src/lib/types";
import { JOURNEYS } from "../src/lib/journeys";

async function main() {
  const only = process.argv[2];
  for (const j of JOURNEYS.filter((x) => !only || x.id === only)) {
    const t0 = Date.now();
    const events: { at: number; e: AgentEvent }[] = [];
    await runAgent({ loves: j.loves, fromCity: j.fromCity, toCity: j.toCity }, (e) => {
      events.push({ at: Date.now() - t0, e });
      if (e.type === "result") console.log("RESULT", j.id, e.plan.matches.map((m) => `${m.source.name} -> ${m.target.name}`).join(" | "));
      else if (e.type !== "done") console.log(j.id, e.type, "label" in e ? e.label : "summary" in e ? e.summary : "text" in e ? e.text : "message" in e ? e.message : "");
    }, { deadlineMs: 120000 });
    writeFileSync(`public/journeys/${j.id}.json`, JSON.stringify({ ...j, recordedAt: new Date().toISOString(), events }, null, 1));
  }
}
main();
