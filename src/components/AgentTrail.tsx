"use client";

import { useEffect, useRef } from "react";
import type { AgentEvent } from "@/lib/types";

const ICON: Record<string, string> = {
  search_entities: "⌕",
  lookup_tags: "#",
  find_equivalents: "⇄",
  find_taste_matches: "✦",
  rank_neighbourhoods: "◎",
  submit_plan: "✓",
};

export default function AgentTrail({ events, running }: { events: AgentEvent[]; running: boolean }) {
  const box = useRef<HTMLOListElement>(null);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [events.length]);

  const results = new Map<string, string>();
  for (const e of events) if (e.type === "tool_result") results.set(e.id, e.summary);
  const start = events.find((e) => e.type === "start") as Extract<AgentEvent, { type: "start" }> | undefined;
  const result = events.find((e) => e.type === "result") as Extract<AgentEvent, { type: "result" }> | undefined;
  const llm = result?.plan.provenance.llm ?? start?.llm;
  const calls = events.filter((e) => e.type === "tool_call").length;

  return (
    <aside className="flex max-h-[640px] flex-col rounded-3xl border border-line bg-ink text-paper lg:sticky lg:top-4">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <div className="font-display text-lg font-semibold">Agent reasoning</div>
          <div className="text-xs text-white/50">
            {start ? `${llm} · Qloo ${start.qlooMode}` : "starting…"} · {calls} steps
          </div>
        </div>
        {running ? (
          <span className="flex items-center gap-2 text-xs text-white/70"><span className="pulse-dot h-2 w-2 rounded-full bg-accent" />working</span>
        ) : (
          <span className="text-xs text-white/50">done</span>
        )}
      </div>
      <ol ref={box} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4 text-sm" aria-live="polite">
        {events.map((e, i) => {
          if (e.type === "thought" && e.auto) {
            return (
              <li key={i} className="rise px-1 text-xs uppercase tracking-wider text-white/45">{e.text}</li>
            );
          }
          if (e.type === "thought") {
            return (
              <li key={i} className="rise rounded-xl bg-white/5 px-3 py-2 italic leading-snug text-white/85">“{e.text}”</li>
            );
          }
          if (e.type === "tool_call") {
            const r = results.get(e.id);
            return (
              <li key={i} className="rise flex gap-3">
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs ${e.name === "submit_plan" ? "bg-accent" : "bg-white/10"}`}>{ICON[e.name] ?? "•"}</span>
                <div className="min-w-0">
                  <div className="font-mono text-[12px] leading-snug text-white/90">{e.label}</div>
                  <div className={`text-xs ${r?.startsWith("Error") ? "text-accent" : "text-white/50"}`}>
                    {r ?? <span className="pulse-dot">calling…</span>}
                  </div>
                </div>
              </li>
            );
          }
          if (e.type === "error") return <li key={i} className="rounded-xl bg-accent/20 px-3 py-2 text-accent">{e.message}</li>;
          return null;
        })}
        {!events.length && <li className="pulse-dot text-white/50">Connecting to the agent…</li>}
      </ol>
    </aside>
  );
}
