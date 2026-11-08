import type { Db } from "./db.ts";
// Shared semantic-duplicate utilities: embeddings, multi-signal similarity, decision logging.
const GATEWAY_EMBED = "https://ai.gateway.lovable.dev/v1/embeddings";
export const EMBED_MODEL = "openai/text-embedding-3-small";
export const EMBED_DIMS = 1536;

export const slugify = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[æå]/g, "a").replace(/ø/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Truncate to a safe token budget (~8k tokens ≈ 24k chars). */
export function clip(text: string, max = 20000) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function embed(input: string, key: string): Promise<number[]> {
  const res = await fetch(GATEWAY_EMBED, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({ model: EMBED_MODEL, input: clip(input) }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return json.data[0].embedding as number[];
}

export async function embedBatch(inputs: string[], key: string): Promise<number[][]> {
  const res = await fetch(GATEWAY_EMBED, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs.map((i) => clip(i, 8000)) }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return (json.data as { index: number; embedding: number[] }[]).sort((a, b) => a.index - b.index).map((d) => d.embedding as number[]);
}

/** Jaccard over meaningful tokens of two headlines. */
export function headlineSimilarity(a: string, b: string) {
  const tok = (s: string) => new Set(slugify(s).split("-").filter((t) => t.length > 2));
  const A = tok(a), B = tok(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export function overlapRatio(a: string[] = [], b: string[] = []) {
  const A = new Set(a.filter(Boolean)), B = new Set(b.filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

export function normalizeUrl(u?: string | null) {
  if (!u) return "";
  try {
    const url = new URL(u);
    return `${url.host.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch { return String(u).toLowerCase().trim(); }
}

export type DupeSignals = {
  semantic: number;
  headline: number;
  entity_overlap: number;
  topic_overlap: number;
  event_similarity: number;
  same_source_url: boolean;
  same_canonical_url: boolean;
  hours_apart: number | null;
};

/** Weighted composite 0-1. Exact URL matches short-circuit to 1. */
export function compositeScore(s: DupeSignals) {
  if (s.same_source_url || s.same_canonical_url) return 1;
  let score =
    s.semantic * 0.55 +
    s.headline * 0.15 +
    s.entity_overlap * 0.12 +
    s.topic_overlap * 0.08 +
    s.event_similarity * 0.10;
  // Near-simultaneous publication of near-identical content is a strong duplicate signal.
  if (s.hours_apart !== null && s.hours_apart <= 48 && s.semantic >= 0.85) score += 0.05;
  return Math.min(1, score);
}

export const DUPLICATE_THRESHOLD = 0.90;
export const MERGE_THRESHOLD = 0.86;

export async function logDecision(supabase: Db, row: {
  candidate_type: string; candidate_ref: string; candidate_title?: string | null;
  decision: string; match_type?: string | null; match_ref?: string | null;
  match_title?: string | null; similarity?: number | null; signals?: unknown; action_taken?: string | null;
}) {
  try {
    await supabase.from("duplicate_decisions").insert({ signals: {}, ...row });
  } catch (e) { console.error("logDecision", e); }
}
