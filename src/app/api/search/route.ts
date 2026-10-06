import { cityCentre } from "@/lib/cities";
import { QlooClient } from "@/lib/qloo/client";

// Autocomplete for the favourites input (Qloo /search).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  const city = url.searchParams.get("city") ?? undefined;
  if (q.length < 2) return Response.json({ results: [] });
  try {
    const results = await new QlooClient().search(q, { take: 6, city, near: cityCentre(city) });
    return Response.json({
      results: results.map((e) => ({ id: e.id, name: e.name, type: e.type.replace("urn:entity:", ""), address: e.address })),
    });
  } catch {
    return Response.json({ results: [] });
  }
}
