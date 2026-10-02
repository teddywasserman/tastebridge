import { runAgent } from "@/lib/agent/run";
import { getCity } from "@/lib/cities";
import { qlooMode } from "@/lib/qloo/client";
import { allow, clientIp } from "@/lib/ratelimit";
import type { AgentEvent } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { loves?: unknown; fromCity?: unknown; toCity?: unknown };
  const loves = Array.isArray(body.loves)
    ? body.loves.map((l) => String(l).trim().slice(0, 80)).filter(Boolean).slice(0, 8)
    : [];
  const fromCity = String(body.fromCity ?? "").trim().slice(0, 40) || "Stockholm";
  const toCity = String(body.toCity ?? "").trim();
  const city = getCity(toCity);
  if (!loves.length || !city) return Response.json({ error: "Add at least one favourite and pick a supported target city." }, { status: 400 });
  if (qlooMode() === "mock" && !city.demo) return Response.json({ error: `${city.name} needs live Qloo data; demo mode covers Lisbon, Berlin and Toronto.` }, { status: 400 });
  if (!allow(clientIp(req))) return Response.json({ error: "Rate limit: please wait a few minutes or try a pre-baked journey." }, { status: 429 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await runAgent({ loves, fromCity, toCity: city.name }, emit);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Agent failed" });
        emit({ type: "done" });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
