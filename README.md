# TasteBridge: move cities, keep your taste

TasteBridge is a relocation agent with taste. You tell it the places you love in your current city: your café, a jazz
club, a cinema, an artist, or a habit like "Sunday flea markets". It then:

1. resolves each favourite in the **Qloo taste graph**;
2. finds its **taste-equivalent in your new city** ("your Drop Coffee in Lisbon is Fábrica Coffee Roasters"), with
   the shared taste tags and Qloo affinity behind each match;
3. ranks the **neighbourhoods that fit you**, using a Qloo affinity heatmap together with where your matches cluster;
4. writes a **first-week plan** that you can step through on a map.

You can watch every step of the agent's reasoning as it works.

**Live demo:** https://tastebridge.vercel.app. It needs no login. Three pre-baked journeys replay instantly, and you
can also build your own.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/) (2026).

## Why

Moving abroad for work or study is lonely. The admin of a move is well served by apps; the cultural side is not. Most
people spend months finding "their" café, bar or venue again. Relocation teams in HR know that slow social integration
is a major reason international assignments fail. TasteBridge treats taste as something you can carry with you: it
starts from what you already love and translates it, place by place, into a new city.

## How Qloo is used

All Qloo calls run server-side through a typed client (`src/lib/qloo/client.ts`). The client sends
`X-Api-Key` to `https://hackathon.api.qloo.com` and includes response caching (6 h LRU), an outbound token-bucket rate
limiter, and bounded retries on 429.

| Agent tool | Qloo endpoint | Purpose |
|---|---|---|
| `search_entities` | `GET /search` | Resolve "Drop Coffee", "Robyn", … to Qloo entity ids and tags |
| `lookup_tags` | `GET /v2/tags` | Turn habits or vibes ("natural wine", "sauna") into tag ids |
| `find_equivalents` | `GET /v2/insights` with `filter.type=urn:entity:place`, `filter.location.query=<new city>`, `signal.interests.entities=<one favourite>`, `filter.tags=<same place genre>`, `feature.explainability=true` | One "then → now" match per favourite, with explainability |
| `find_taste_matches` | `GET /v2/insights` (places, whole profile: entities + tags as signals) | Broader picks for the week plan |
| `rank_neighbourhoods` | `GET /v2/insights` with `filter.type=urn:heatmap` | Taste affinity by area, aggregated into named neighbourhoods |
| `/api/search` (UI) | `GET /search` | Autocomplete for the favourites input |

The final `submit_plan` step is validated on the server. The model can only reference entity ids that Qloo actually
returned, and unknown ids are dropped, so the agent cannot invent venues. Shared tags are computed from Qloo tags, not
written by the model. Matches below 50% affinity are labelled as weak signals.

Qloo results are aggregate affinities and say nothing about any individual. TasteBridge sends Qloo only public cultural
entities and city names, never personal data.

## Architecture

```
Browser (Next.js App Router, MapLibre GL + CARTO/OSM tiles)
   │  POST /api/agent  ← NDJSON stream of agent events (thoughts, tool calls, results)
   ▼
Agent loop (src/lib/agent/run.ts)
   Gemini function calling (gemini-3.8-flash) ──► tools (src/lib/agent/tools.ts) ──► Qloo client
   └─ deterministic autopilot fallback: the same tools with a fixed strategy, used if the LLM is unavailable
```

- **Streaming reasoning:** the UI renders each agent step as it happens.
- **Demo journeys:** recorded agent runs (`public/journeys/*.json`, made with `npm run bake`) replay instantly.
- **Abuse protection:** per-IP limit on agent runs, plus the Qloo cache and rate limiter.
- **Mock mode:** when `QLOO_API_KEY` is not set, the client serves offline fixtures shaped like Qloo responses
  (`src/lib/qloo/mock.ts`). They use real public venues with hand-assigned tags, so the whole product works end to end.
  The parsing code is identical in both modes. The header badge shows which mode is active.

## Run locally

```bash
npm install
cp .env.example .env.local   # add QLOO_API_KEY and GEMINI_API_KEY (both optional)
npm run dev                  # http://localhost:3000
npm test                     # vitest: Qloo client + agent
```

Requires Node 20+.

## Limitations

- In mock mode, results come from a small hand-tagged catalogue that covers Lisbon, Berlin and Toronto. They illustrate
  the flow and are not Qloo output.
- Neighbourhood centroids are hand-picked per city, and heatmap cells are assigned to the nearest one.
- An affinity score is a statistical association across many people. It is not a promise that you will love a place.

## Credits and disclosure

Built by Teddy Wasserman with substantial assistance from **Claude Code** (Anthropic's AI coding agent), which wrote
much of the code under my direction. Taste data comes from the [Qloo](https://qloo.com) Taste AI API. The agent runs on
Google Gemini. Map tiles © OpenStreetMap contributors, © CARTO.

MIT licensed. See [LICENSE](LICENSE).
