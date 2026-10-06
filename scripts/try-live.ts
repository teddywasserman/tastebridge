// Ad-hoc live run: npx tsx scripts/try-live.ts "Stockholm" "Lisbon" "Drop Coffee|Fasching" [autopilot]
import { runAgent } from "../src/lib/agent/run";
const [from = "Stockholm", to = "Lisbon", loves = "Drop Coffee|Fasching", mode] = process.argv.slice(2);
const t0 = Date.now();
runAgent({ fromCity: from, toCity: to, loves: loves.split("|") }, (e) => {
  const t = ((Date.now() - t0) / 1000).toFixed(1);
  if (e.type === "result") {
    const p = e.plan;
    console.log(`[${t}s] RESULT qloo=${p.provenance.qlooMode} calls=${p.provenance.qlooCalls} llm=${p.provenance.llm}`);
    console.log("SUMMARY", p.summary);
    for (const m of p.matches) console.log(`  ${m.source.name} -> ${m.target.name} [${m.target.neighbourhood}] ${Math.round(m.affinity * 100)}% | ${m.sharedTags.slice(0, 4).join(", ")} | ${m.why}`);
    console.log("HOODS", p.neighbourhoods.map((n) => `${n.name} ${n.score}`).join(", "));
    for (const d of p.week) console.log(`  ${d.day} ${d.title}: ${d.items.map((i) => `${i.time} ${i.entity.name}`).join("; ")}`);
  } else if (e.type === "tool_call") console.log(`[${t}s] call ${e.label}`);
  else if (e.type === "tool_result") console.log(`[${t}s]   -> ${e.summary}`);
  else if (e.type === "thought") console.log(`[${t}s] thought: ${e.text}`);
  else if (e.type === "error") console.log(`[${t}s] ERROR ${e.message}`);
}, { useLlm: mode !== "autopilot", deadlineMs: 55000 }).then(() => console.log(`total ${((Date.now() - t0) / 1000).toFixed(1)}s`));
