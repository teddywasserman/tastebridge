// Shared types for TasteBridge. Entities are normalised from Qloo responses
// (live or mock) so the agent and UI never depend on raw API shapes.

export interface Tag {
  id: string;
  name: string;
  /** "category" for place genres (urn:tag:genre:place:*), otherwise "keyword" */
  kind: "category" | "keyword";
  /** Qloo tag family, e.g. urn:tag:genre:place, urn:tag:ambience:qloo */
  type?: string;
}

export interface Entity {
  id: string;
  name: string;
  /** e.g. urn:entity:place, urn:entity:artist */
  type: string;
  address?: string;
  city?: string;
  /** neighbourhood label as reported by Qloo (properties.neighborhood) */
  qlooNeighbourhood?: string;
  /** short Qloo description of the place */
  description?: string;
  image?: string;
  /** properties.primary_genre, e.g. urn:tag:genre:place:restaurant:wine_bar */
  primaryGenre?: Tag;
  lat?: number;
  lon?: number;
  tags: Tag[];
  popularity?: number;
  /** query.affinity from /v2/insights (0..1) */
  affinity?: number;
  /** feature.explainability: signal entity id -> contribution score */
  explain?: Record<string, number>;
  neighbourhood?: string;
}

export interface Match {
  source: Entity;
  target: Entity;
  sharedTags: string[];
  affinity: number;
  why: string;
  alternatives: Entity[];
}

export interface NeighbourhoodFit {
  name: string;
  score: number; // 0..100
  lat: number;
  lon: number;
  highlights: string[];
  why: string;
}

export interface PlanItem {
  time: string;
  entity: Entity;
  note: string;
}

export interface PlanDay {
  day: string;
  title: string;
  items: PlanItem[];
}

export interface TastePlan {
  fromCity: string;
  toCity: string;
  summary: string;
  sources: Entity[];
  matches: Match[];
  neighbourhoods: NeighbourhoodFit[];
  week: PlanDay[];
  extras: Entity[];
  provenance: { qlooCalls: number; qlooMode: "live" | "mock"; llm: string };
}

export type AgentEvent =
  | { type: "start"; qlooMode: "live" | "mock"; llm: string; fromCity: string; toCity: string; loves: string[] }
  | { type: "thought"; text: string; /** narrated by the app from the tool calls, not written by the model */ auto?: boolean }
  | { type: "tool_call"; id: string; name: string; label: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; summary: string }
  | { type: "result"; plan: TastePlan }
  | { type: "error"; message: string }
  | { type: "done" };

export interface AgentInput {
  loves: string[];
  fromCity: string;
  toCity: string;
}
