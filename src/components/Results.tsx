"use client";

import type { Entity, TastePlan } from "@/lib/types";

function kind(e: Entity) {
  if (e.type === "concept") return "habit / vibe";
  const cat = e.tags.find((t) => t.kind === "category");
  return cat?.name ?? e.type.replace("urn:entity:", "");
}

function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
      <h3 className="mt-1 font-display text-3xl font-semibold tracking-tight">{title}</h3>
      {sub && <p className="mt-1 max-w-2xl text-sm text-ink-2">{sub}</p>}
    </div>
  );
}

export function MatchCards({ plan, onSelect }: { plan: TastePlan; onSelect: (id: string) => void }) {
  return (
    <div>
      <SectionTitle eyebrow="Then → now" title={`Your ${plan.fromCity} places, translated`}
        sub="Each match comes from Qloo insights seeded with the place you love, filtered to the same kind of place in your new city. Chips show the taste tags they share." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plan.matches.map((m, i) => (
          <article key={m.source.id} className="rise flex flex-col rounded-3xl border border-line bg-card p-5 shadow-sm" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-ink-3">Then · {plan.fromCity}</div>
                <div className="truncate font-medium text-ink-2">{m.source.name}</div>
                <div className="text-xs text-ink-3">{kind(m.source)}</div>
              </div>
              <span className="mt-3 text-xl text-accent" aria-hidden>→</span>
              <button onClick={() => onSelect(m.target.id)} className="min-w-0 flex-1 text-left">
                <div className="text-[11px] uppercase tracking-wider text-accent">Now · {plan.toCity}</div>
                <div className="font-display text-lg font-semibold leading-tight hover:underline">
                  <span className="mr-1.5 inline-grid h-5 w-5 place-items-center rounded-full bg-accent align-middle font-sans text-[10px] text-white">{i + 1}</span>
                  {m.target.name}
                </div>
                <div className="text-xs text-ink-3">{m.target.neighbourhood ?? kind(m.target)}</div>
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(m.affinity * 100)}%` }} />
              </div>
              <span className="w-24 text-right text-xs font-medium text-ink-2">{m.affinity ? `${Math.round(m.affinity * 100)}% affinity` : "no affinity score"}</span>
            </div>
            {m.sharedTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.sharedTags.slice(0, 5).map((t) => (
                  <span key={t} className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs text-teal">{t}</span>
                ))}
              </div>
            )}
            <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-2">{m.why}</p>
            {m.alternatives.length > 0 && (
              <p className="mt-3 border-t border-line pt-3 text-xs text-ink-3">
                Also try: {m.alternatives.map((a, j) => (
                  <span key={a.id}>
                    {j > 0 && ", "}
                    <button onClick={() => onSelect(a.id)} className="underline decoration-line underline-offset-2 hover:text-ink">{a.name}</button>
                  </span>
                ))}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

export function Neighbourhoods({ plan }: { plan: TastePlan }) {
  return (
    <div>
      <SectionTitle eyebrow="Where to live" title="Neighbourhood fit" sub="Qloo heatmap affinity for your combined taste profile, plus where your matches cluster." />
      <ol className="space-y-3">
        {plan.neighbourhoods.map((n, i) => (
          <li key={n.name} className="rise rounded-2xl border border-line bg-card p-4" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-display text-lg font-semibold"><span className="mr-2 text-ink-3">{i + 1}</span>{n.name}</div>
              <div className="font-display text-2xl font-semibold text-accent">{n.score}</div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-2">
              <div className="h-full rounded-full bg-gradient-to-r from-gold to-accent" style={{ width: `${n.score}%` }} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-2">{n.why}</p>
            {n.highlights.length > 0 && <p className="mt-1 text-xs text-ink-3">Near: {n.highlights.join(" · ")}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function WeekPlan({ plan, day, onDay }: { plan: TastePlan; day: number | null; onDay: (d: number | null) => void }) {
  return (
    <div>
      <SectionTitle eyebrow="First week" title="Feel at home by Sunday" sub="Tap a day to see its route on the map." />
      <div className="space-y-3">
        {plan.week.map((d, i) => {
          const on = day === i;
          return (
            <button key={d.day + i} onClick={() => onDay(on ? null : i)}
              className={`rise block w-full rounded-2xl border p-4 text-left transition ${on ? "border-teal bg-teal-soft/60" : "border-line bg-card hover:border-teal"}`}
              style={{ animationDelay: `${i * 50}ms` }} aria-pressed={on}>
              <div className="flex items-baseline gap-3">
                <span className="w-10 shrink-0 font-display text-lg font-semibold text-teal">{d.day.slice(0, 3)}</span>
                <span className="font-medium">{d.title}</span>
              </div>
              <ul className="mt-2 space-y-1.5 pl-[3.25rem]">
                {d.items.map((it) => (
                  <li key={it.entity.id + it.time} className="text-sm leading-snug">
                    <span className="mr-2 font-mono text-xs text-ink-3">{it.time}</span>
                    <span className="font-medium">{it.entity.name}</span>
                    <span className="text-ink-2"> · {it.note}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
