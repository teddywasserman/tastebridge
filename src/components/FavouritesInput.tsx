"use client";

import { useEffect, useState } from "react";

interface Suggestion { id: string; name: string; type: string; address?: string }

export default function FavouritesInput({ values, onChange, city }: { values: string[]; onChange: (v: string[]) => void; city: string }) {
  const [text, setText] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&city=${encodeURIComponent(city)}`, { signal: ctrl.signal })
        .then((r) => r.json()).then((j) => setSugs(j.results ?? [])).catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [text, city]);

  const add = (v: string) => {
    const s = v.trim();
    if (s && !values.includes(s) && values.length < 8) onChange([...values, s]);
    setText(""); setSugs([]);
  };

  return (
    <div className="relative">
      <div className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-xl border border-line bg-paper px-2.5 py-2 focus-within:border-accent">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-sm text-[#7a2a10]">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="ml-0.5 text-[#7a2a10]/60 hover:text-[#7a2a10]">×</button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(text); }
            if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
          }}
          placeholder={values.length ? "Add another…" : "e.g. Drop Coffee, Fotografiska, jazz clubs"}
          className="min-w-[160px] flex-1 bg-transparent px-1 py-1 outline-none placeholder:text-ink-3"
          aria-label="Add something you love"
        />
      </div>
      {open && text.trim().length >= 2 && sugs.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-card shadow-lg">
          {sugs.map((s) => (
            <li key={s.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s.name)}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left hover:bg-paper">
                <span className="font-medium">{s.name}</span>
                <span className="truncate text-xs text-ink-3">{s.type}{s.address ? ` · ${s.address}` : ""}</span>
              </button>
            </li>
          ))}
          <li className="border-t border-line px-3 py-1.5 text-[11px] text-ink-3">Suggestions from Qloo /search · press Enter to add free text</li>
        </ul>
      )}
    </div>
  );
}
