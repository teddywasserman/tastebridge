// The TasteBridge agent loop. Gemini plans and calls Qloo-backed tools; every
// step is streamed to the UI. If the LLM is unavailable or stalls, a
// deterministic autopilot finishes the same job from the same session state.

import { QlooClient } from "../qloo/client";
import type { AgentEvent, AgentInput } from "../types";
import {
  TOOL_DECLARATIONS, TOOL_LABELS, TasteSession, findEquivalents, findTasteMatches, lookupTags,
  rankNeighbourhoods, runTool, searchEntities, submitPlan, topTagNames,
} from "./tools";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_TURNS = 14;

type Emit = (e: AgentEvent) => void;

interface Part { text?: string; thought?: boolean; functionCall?: { name: string; args?: Record<string, unknown>; id?: string }; thoughtSignature?: string }
interface Content { role: "user" | "model"; parts: (Part | { functionResponse: { name: string; id?: string; response: unknown } })[] }

function systemPrompt(input: AgentInput, s: TasteSession) {
  return `You are TasteBridge, a relocation agent that carries a person's cultural taste from ${input.fromCity} to ${s.city.name}.
You have tools backed by the Qloo taste graph. Work like this:
1. Resolve each thing the user loves with search_entities (pass city="${input.fromCity}" for places). Pick the candidate that clearly matches; if nothing matches, treat it as a concept and call lookup_tags.
2. For every resolved love call find_equivalents (source_entity_id, or concept + tag_ids). Several calls in one turn are fine.
3. Call find_taste_matches once, then rank_neighbourhoods once.
4. Call submit_plan: one match per source (choose the best equivalent, not always the first, considering shared tags and affinity), a one-sentence grounded "why" each, and a 7-day first-week plan (Mon..Sun, 1-3 items/day, realistic times, cluster items by neighbourhood, start the week in the best-fit neighbourhood).
Rules: before each batch of tool calls write ONE short sentence (max 20 words) saying what you are doing and why. Only use entity ids returned by tools. In notes and whys, describe the vibe using the Qloo tags you saw; do not state unverifiable facts (founding years, 'oldest', awards, specific menu items). Qloo results are aggregate affinities, never claims about the individual. Be concise and warm. Never ask the user questions.`;
}

async function gemini(contents: Content[], system: string): Promise<Part[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      generationConfig: { temperature: 0.4 },
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: Part[] } }[] };
  return data.candidates?.[0]?.content?.parts ?? [];
}

export async function runAgent(input: AgentInput, emit: Emit, opts: { useLlm?: boolean; deadlineMs?: number } = {}): Promise<void> {
  const client = new QlooClient();
  const useLlm = opts.useLlm !== false && !!process.env.GEMINI_API_KEY;
  const s = new TasteSession(client, input.fromCity, input.toCity, useLlm ? GEMINI_MODEL : "autopilot");
  const deadline = Date.now() + (opts.deadlineMs ?? 50000);
  emit({ type: "start", qlooMode: client.mode, llm: s.llm, fromCity: input.fromCity, toCity: s.city.name, loves: input.loves });

  let callN = 0;
  const call = async (name: string, args: Record<string, unknown>) => {
    const id = `t${++callN}`;
    emit({ type: "tool_call", id, name, label: TOOL_LABELS[name]?.(args, s) ?? name, args });
    try {
      const out = await runTool(name, args, s);
      emit({ type: "tool_result", id, name, summary: out.summary });
      return out.result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit({ type: "tool_result", id, name, summary: `Error: ${message.slice(0, 120)}` });
      return { error: message };
    }
  };

  if (useLlm) {
    try {
      const system = systemPrompt(input, s);
      const contents: Content[] = [{
        role: "user",
        parts: [{ text: `I'm moving from ${input.fromCity} to ${s.city.name}. Things I love at home:\n${input.loves.map((l) => `- ${l}`).join("\n")}` }],
      }];
      let nudged = false;
      for (let turn = 0; turn < MAX_TURNS && !s.plan && Date.now() < deadline; turn++) {
        const parts = await gemini(contents, system);
        contents.push({ role: "model", parts });
        for (const p of parts) if (p.text && !p.thought && p.text.trim()) emit({ type: "thought", text: p.text.trim() });
        const calls = parts.filter((p) => p.functionCall);
        if (!calls.length) {
          if (nudged) break;
          nudged = true;
          contents.push({ role: "user", parts: [{ text: "Continue with the tools and finish by calling submit_plan." }] });
          continue;
        }
        const responses = [];
        for (const p of calls) {
          const fc = p.functionCall!;
          const result = await call(fc.name, fc.args ?? {});
          responses.push({ functionResponse: { name: fc.name, ...(fc.id ? { id: fc.id } : {}), response: { result } } });
        }
        contents.push({ role: "user", parts: responses });
      }
    } catch (err) {
      emit({ type: "thought", text: `The language model is unavailable (${err instanceof Error ? err.message.slice(0, 80) : "error"}), so the deterministic autopilot finishes the plan with the same Qloo tools.` });
    }
  }

  if (!s.plan) await autopilot(input, s, call, emit);
  if (s.plan) {
    s.plan.provenance.qlooCalls = client.stats.calls;
    emit({ type: "result", plan: s.plan });
  } else {
    emit({ type: "error", message: "Could not build a plan." });
  }
  emit({ type: "done" });
}

/** Deterministic planner: same tools, fixed strategy. Resumes from existing session state. */
async function autopilot(input: AgentInput, s: TasteSession, call: (n: string, a: Record<string, unknown>) => Promise<unknown>, emit: Emit) {
  if (!s.sources.size) emit({ type: "thought", text: `Resolving your ${input.loves.length} favourites in Qloo's taste graph.` });
  for (const love of input.loves) {
    const already = [...s.sources.values()].some((e) => e.name.toLowerCase() === love.toLowerCase() || love.toLowerCase().includes(e.name.toLowerCase()));
    if (already) continue;
    const r = (await call("search_entities", { query: love, city: input.fromCity })) as { candidates?: { id: string; name: string }[] };
    const hit = r.candidates?.find((c) => love.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(love.toLowerCase()));
    if (hit) {
      await call("find_equivalents", { source_entity_id: hit.id });
    } else {
      const t = (await call("lookup_tags", { concept: love })) as { tags?: { id: string }[] };
      if (t.tags?.length) await call("find_equivalents", { concept: love, tag_ids: t.tags.map((x) => x.id) });
    }
  }
  if (!s.extras.length) await call("find_taste_matches", { take: 12 });
  if (!s.neighbourhoods.length) await call("rank_neighbourhoods", {});
  const tags = topTagNames(s);
  emit({ type: "thought", text: `Composing the plan around ${tags.join(", ") || "your favourites"}, starting in ${s.neighbourhoods[0]?.name ?? s.city.name}.` });
  await call("submit_plan", {
    summary: `Your ${input.fromCity} favourites point to a taste for ${tags.join(", ") || "distinctive local places"}. In ${s.city.name}, start in ${s.neighbourhoods[0]?.name ?? "the centre"}${s.neighbourhoods[1] ? ` and ${s.neighbourhoods[1].name}` : ""}, where your matches cluster.`,
    matches: [],
    week: [],
  });
}

// re-export for tests
export { searchEntities, lookupTags, findEquivalents, findTasteMatches, rankNeighbourhoods, submitPlan };
