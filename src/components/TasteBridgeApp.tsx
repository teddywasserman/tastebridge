"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCity, SOURCE_CITIES, TARGET_CITIES } from "@/lib/cities";
import { JOURNEYS, JourneyMeta } from "@/lib/journeys";
import type { AgentEvent, TastePlan } from "@/lib/types";
import AgentTrail from "./AgentTrail";
import FavouritesInput from "./FavouritesInput";
import { MatchCards, Neighbourhoods, WeekPlan } from "./Results";

const TasteMap = dynamic(() => import("./TasteMap"), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-paper-2" /> });

type Phase = "idle" | "running" | "done" | "error";

export default function TasteBridgeApp() {
  const [status, setStatus] = useState<{ qloo: "live" | "mock"; llm: string } | null>(null);
  const [fromCity, setFromCity] = useState("Stockholm");
  const [toCity, setToCity] = useState("Lisbon");
  const [loves, setLoves] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [plan, setPlan] = useState<TastePlan | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [replaying, setReplaying] = useState<string | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | undefined>();
  const runId = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ qloo: "mock", llm: "autopilot" }));
  }, []);

  const targetOptions = useMemo(
    () => TARGET_CITIES.filter((c) => status?.qloo === "live" || c.demo),
    [status],
  );
  const city = getCity(plan?.toCity ?? toCity) ?? TARGET_CITIES[0];

  const push = useCallback((e: AgentEvent) => {
    setEvents((prev) => [...prev, e]);
    if (e.type === "result") { setPlan(e.plan); setDay(null); setSelected(undefined); }
    if (e.type === "error") { setError(e.message); }
    if (e.type === "done") setPhase((p) => (p === "running" ? "done" : p));
  }, []);

  const reset = (id: number) => {
    runId.current = id;
    setEvents([]); setPlan(undefined); setError(null); setPhase("running"); setDay(null); setSelected(undefined);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  async function runLive() {
    if (!loves.length) { setError("Add at least one place, artist or thing you love."); return; }
    const id = Date.now();
    reset(id);
    setReplaying(null);
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loves, fromCity, toCity }) });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) if (l.trim() && runId.current === id) push(JSON.parse(l));
      }
      if (runId.current === id) setPhase((p) => (p === "running" ? "done" : p));
    } catch (err) {
      if (runId.current === id) { setError(err instanceof Error ? err.message : "Something went wrong"); setPhase("error"); }
    }
  }

  async function replay(j: JourneyMeta) {
    const id = Date.now();
    reset(id);
    setReplaying(j.id);
    setFromCity(j.fromCity); setToCity(j.toCity); setLoves(j.loves);
    try {
      const data = (await (await fetch(`/journeys/${j.id}.json`)).json()) as { events: { at: number; e: AgentEvent }[] };
      const total = data.events.at(-1)?.at ?? 1;
      const scale = Math.min(1, 9000 / total);
      const t0 = performance.now();
      for (const { at, e } of data.events) {
        const wait = at * scale - (performance.now() - t0);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (runId.current !== id) return;
        push(e);
      }
    } catch {
      if (runId.current === id) { setError("Could not load the demo journey."); setPhase("error"); }
    }
  }

  const dayFocus = day !== null && plan ? plan.week[day]?.items.map((i) => i.entity.id) : undefined;
  const replayMeta = JOURNEYS.find((j) => j.id === replaying);

  return (
    <div className="grain min-h-screen">
      {/* header */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="TasteBridge home">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
            <path d="M3 22c4-9 9-13 13-13s9 4 13 13" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M3 22h26M9 22v-5.5M16 22v-8M23 22v-5.5" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="font-display text-xl font-semibold tracking-tight">TasteBridge</span>
        </Link>
        <div className="flex items-center gap-2 text-xs">
          {status && (
            <span className={`rounded-full px-2.5 py-1 font-medium ${status.qloo === "live" ? "bg-teal-soft text-teal" : "bg-paper-2 text-ink-2"}`}
              title={status.qloo === "live" ? "Calling the Qloo hackathon API" : "Qloo key pending: using offline fixtures shaped like Qloo responses"}>
              {status.qloo === "live" ? "● Live Qloo data" : "◌ Demo data (Qloo-shaped)"}
            </span>
          )}
          <a href="https://github.com/teddywasserman/tastebridge" className="hidden rounded-full border border-line px-2.5 py-1 text-ink-2 hover:bg-card sm:inline">GitHub</a>
        </div>
      </header>

      {/* hero + form */}
      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-4 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-10">
        <div className="rise">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-accent">Relocation, with taste</p>
          <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            Move cities.<br />Keep your <em className="text-accent">taste</em>.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            Tell TasteBridge the places you love at home. An AI agent reads them through the Qloo taste graph, finds their
            equivalents in your new city, ranks the neighbourhoods that fit you, and plans your first week.
          </p>
          <div className="mt-8">
            <p className="mb-3 text-sm font-medium text-ink-2">Try a ready-made journey (instant replay)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {JOURNEYS.map((j) => (
                <button key={j.id} onClick={() => replay(j)}
                  className="group rounded-2xl border border-line bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
                  <div className="font-display text-lg font-semibold">{j.title}</div>
                  <div className="mt-1 text-xs leading-snug text-ink-3">{j.persona}</div>
                  <div className="mt-3 text-xs font-medium text-accent group-hover:underline">Play journey →</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <form className="rise rounded-3xl border border-line bg-card p-5 shadow-[0_10px_40px_-20px_rgba(29,26,22,.35)] sm:p-7"
          onSubmit={(e) => { e.preventDefault(); runLive(); }}>
          <h2 className="font-display text-2xl font-semibold">Build your own bridge</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink-2">I live in</span>
              <select value={fromCity} onChange={(e) => setFromCity(e.target.value)} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5">
                {SOURCE_CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink-2">I&apos;m moving to</span>
              <select value={toCity} onChange={(e) => setToCity(e.target.value)} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5">
                {targetOptions.map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4">
            <span className="mb-1 block text-sm font-medium text-ink-2">What I love at home</span>
            <FavouritesInput values={loves} onChange={setLoves} city={fromCity} />
            <p className="mt-2 text-xs text-ink-3">Cafés, bars, venues, museums, artists, or just a habit (&ldquo;Sunday flea markets&rdquo;). Up to 8.</p>
          </div>
          {error && phase !== "running" && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-[#8a2f12]">{error}</p>}
          <button type="submit" disabled={phase === "running"}
            className="mt-5 w-full rounded-xl bg-ink px-4 py-3.5 font-medium text-paper transition hover:bg-accent disabled:opacity-60">
            {phase === "running" && !replaying ? "Agent is working…" : `Bridge my taste to ${toCity} →`}
          </button>
          <p className="mt-3 text-center text-xs text-ink-3">A live run takes ~30 s: the agent makes ~15 Qloo calls.</p>
        </form>
      </section>

      {/* results */}
      {phase !== "idle" && (
        <section ref={resultsRef} className="mx-auto max-w-7xl scroll-mt-4 px-4 pb-20 sm:px-8">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-8">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              {(plan?.fromCity ?? fromCity)} <span className="text-accent">→</span> {city.name}
            </h2>
            {replayMeta && <span className="text-xs text-ink-3">Replay of a recorded agent run · {replayMeta.persona}</span>}
          </div>
          <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
            <AgentTrail events={events} running={phase === "running"} />
            <div className="flex flex-col gap-5">
              <div className="relative h-[420px] overflow-hidden rounded-3xl border border-line bg-paper-2 sm:h-[520px]">
                <TasteMap city={city} plan={plan} focusIds={dayFocus} selectedId={selected} onSelect={setSelected} />
                {!plan && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-card/90 px-4 py-2 text-sm text-ink-2 shadow">
                    Pins appear when the agent finishes…
                  </div>
                )}
              </div>
              {plan && (
                <div className="rise rounded-3xl border border-line bg-card p-5 sm:p-6">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">Your taste, in a nutshell</p>
                  <p className="mt-2 font-display text-xl leading-snug">{plan.summary}</p>
                </div>
              )}
            </div>
          </div>
          {plan && (
            <div className="mt-10 flex flex-col gap-12">
              <MatchCards plan={plan} onSelect={(id) => { setDay(null); setSelected(id); }} />
              <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
                <Neighbourhoods plan={plan} />
                <WeekPlan plan={plan} day={day} onDay={(d) => { setSelected(undefined); setDay(d); }} />
              </div>
              <Provenance plan={plan} />
            </div>
          )}
        </section>
      )}

      <footer className="border-t border-line py-8 text-center text-xs text-ink-3">
        TasteBridge · taste data from the Qloo Taste AI API · agent by Gemini · map © OpenStreetMap contributors, © CARTO.
        Qloo results describe aggregate affinities, not facts about any individual.
      </footer>
    </div>
  );
}

function Provenance({ plan }: { plan: TastePlan }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-4 text-xs leading-relaxed text-ink-3">
      <strong className="text-ink-2">How this was made.</strong> {plan.provenance.qlooCalls} Qloo tool calls
      ({plan.provenance.qlooMode === "live" ? "live hackathon API" : "offline demo fixtures shaped like Qloo responses; live Qloo data is enabled once the event key is configured"}),
      planned by {plan.provenance.llm === "autopilot" ? "the deterministic autopilot" : plan.provenance.llm}. Matches use Qloo /search → /v2/insights
      (filter.type=urn:entity:place, signal.interests.entities, feature.explainability); neighbourhoods use the urn:heatmap insight. Every venue in the plan
      was returned by Qloo; the agent cannot invent places. Affinities describe aggregate taste, not predictions about you.
    </div>
  );
}
