// Shared pre-generation coverage/duplicate guard for evergreen content
// (knowledge pages, guides, comparisons). Slug uniqueness is only the last line.
//
// Order of barriers (cheapest first, all deterministic before semantic):
//   1. Exact slug in the target table           -> UPDATE_EXISTING (refresh) / SKIP_DUPLICATE
//   2. Mirrored comparison pair (B vs A)        -> SKIP_DUPLICATE
//   3. Normalized title across all evergreen + article tables
//        same type -> SKIP_DUPLICATE, other type -> REVIEW_REQUIRED
//   4. Semantic: evaluateDuplicate() (pgvector cosine via match_editorial_content)
//        composite >= DUPLICATE_THRESHOLD                -> SKIP_DUPLICATE
//        cosine >= 0.86, same evergreen type             -> UPDATE_EXISTING
//        cosine >= 0.86, other type (news, intent, ...)  -> REVIEW_REQUIRED
//   5. Semantic layer unavailable (e.g. gateway 402)     -> REVIEW_REQUIRED (fail closed)
//   6. Otherwise                                          -> CREATE_NEW
import { evaluateDuplicate, recordVerdict, type Candidate } from "./dupe.ts";
import { slugify, DUPLICATE_THRESHOLD, logDecision } from "./semantic.ts";
import type { Db } from "./db.ts";

/** Loosely structured JSON returned by the evergreen AI generators (all fields optional). */
export type EvergreenAiOutput = {
  title?: string; summary?: string; content?: string; meta_title?: string; meta_description?: string;
  key_takeaways?: string[]; faq?: { q: string; a: string }[]; steps?: unknown[]; resources?: unknown[];
  pros_cons?: Record<string, unknown>; estimated_read_time?: number;
};

export type GuardCache = { titles?: TitleIndexRow[] };
export type GuardVerdict = GuardResult & { slug: string };

export type TitleIndexRow = { type: string; ref: string; title: string; n: string };

export type EvergreenDecision = "CREATE_NEW" | "UPDATE_EXISTING" | "SKIP_DUPLICATE" | "REVIEW_REQUIRED";
export type EvergreenType = "knowledge" | "guide" | "comparison" | "intent";

export const SEMANTIC_COSINE_THRESHOLD = 0.86;

const TABLE: Record<EvergreenType, string> = {
  knowledge: "knowledge_pages", guide: "guides", comparison: "comparison_pages", intent: "search_intents",
};

export type GuardInput = {
  type: EvergreenType;
  slug: string;
  title: string;
  text?: string;          // intent/brief text available before generation
  entities?: string[];
  topics?: string[];
  altSlugs?: string[];    // e.g. mirrored comparison slug
};

export type GuardResult = {
  decision: EvergreenDecision;
  barrier: string;
  reason: string;
  match: { type: string; ref: string; title: string; similarity?: number } | null;
  composite?: number;
};

const normTitle = (s: string) =>
  slugify(s).split("-").filter((t) => t.length > 1 && !["hva", "er", "en", "et", "slik", "til", "guide", "vs", "og"].includes(t)).sort().join(" ");

async function titleIndex(supabase: Db) {
  const out: TitleIndexRow[] = [];
  for (const [type, table] of [["knowledge", "knowledge_pages"], ["guide", "guides"], ["comparison", "comparison_pages"], ["report", "research_reports"]] as const) {
    const { data } = await supabase.from(table).select("slug,title");
    for (const r of data || []) out.push({ type, ref: r.slug, title: r.title, n: normTitle(r.title) });
  }
  return out;
}

export async function evergreenGuard(
  supabase: Db, apiKey: string, c: GuardInput,
  opts: { allowUpdate?: boolean; noAI?: boolean; cache?: { titles?: TitleIndexRow[] } } = {},
): Promise<GuardResult> {
  const table = TABLE[c.type];

  // 1. Exact slug (intents: the candidate row itself owns target_slug; cross-table collisions are checked by the caller)
  const { data: own } = c.type === "intent" ? { data: null } : await supabase.from(table).select("slug,title").eq("slug", c.slug).maybeSingle();
  if (own) {
    return {
      decision: opts.allowUpdate ? "UPDATE_EXISTING" : "SKIP_DUPLICATE",
      barrier: "slug", reason: "same slug already exists",
      match: { type: c.type, ref: own.slug, title: own.title },
    };
  }

  // 2. Alternate slugs (mirrored comparison)
  for (const alt of c.type === "intent" ? [] : c.altSlugs || []) {
    const { data: m } = await supabase.from(table).select("slug,title").eq("slug", alt).maybeSingle();
    if (m) return { decision: "SKIP_DUPLICATE", barrier: "mirror_slug", reason: "same pair exists in reverse order", match: { type: c.type, ref: m.slug, title: m.title } };
  }

  // 3. Normalized title across evergreen tables + exact article title
  const titles = opts.cache?.titles ?? await titleIndex(supabase);
  if (opts.cache && !opts.cache.titles) opts.cache.titles = titles;
  const n = normTitle(c.title);
  const hit = n ? titles.find((t) => t.n === n) : null;
  if (hit) {
    return hit.type === c.type
      ? { decision: "SKIP_DUPLICATE", barrier: "normalized_title", reason: "same normalized title, same page type", match: hit }
      : { decision: "REVIEW_REQUIRED", barrier: "normalized_title", reason: `same normalized title as existing ${hit.type}`, match: hit };
  }
  const { data: art } = await supabase.from("articles").select("slug,title").eq("published", true).ilike("title", c.title).limit(1);
  if (art?.length) return { decision: "REVIEW_REQUIRED", barrier: "normalized_title", reason: "identical title as published article", match: { type: "article", ref: art[0].slug, title: art[0].title } };

  // 4. Semantic
  if (opts.noAI) return { decision: "REVIEW_REQUIRED", barrier: "semantic_not_requested", reason: "No cached query embedding supplied; semantic coverage cannot be concluded without an AI request", match: null };
  const cand: Candidate = { type: c.type, ref: c.slug, title: c.title, text: c.text || "", entities: c.entities, topics: c.topics };
  let v;
  try {
    v = await evaluateDuplicate(supabase, apiKey, cand);
  } catch (e_: unknown) { const e = e_ instanceof Error ? e_ : new Error(String(e_));
    return { decision: "REVIEW_REQUIRED", barrier: "semantic_unavailable", reason: `semantic check failed: ${String(e.message).slice(0, 120)}`, match: null };
  }
  const top = (v.candidates || [])[0];
  if (v.match && v.score >= DUPLICATE_THRESHOLD) {
    return { decision: "SKIP_DUPLICATE", barrier: "semantic_composite", reason: `composite ${v.score.toFixed(3)} >= ${DUPLICATE_THRESHOLD}`, match: { type: v.match.content_type, ref: v.match.ref, title: v.match.title, similarity: v.match.similarity }, composite: v.score };
  }
  if (top && Number(top.similarity) >= SEMANTIC_COSINE_THRESHOLD) {
    const m = { type: top.content_type, ref: top.ref, title: top.title, similarity: Number(top.similarity) };
    return top.content_type === c.type
      ? { decision: "UPDATE_EXISTING", barrier: "semantic_cosine", reason: `cosine ${m.similarity.toFixed(3)} with existing ${c.type}`, match: m, composite: v.score }
      : { decision: "REVIEW_REQUIRED", barrier: "semantic_cosine", reason: `cosine ${m.similarity.toFixed(3)} with existing ${top.content_type}`, match: m, composite: v.score };
  }
  return { decision: "CREATE_NEW", barrier: "none", reason: "no coverage found", match: top ? { type: top.content_type, ref: top.ref, title: top.title, similarity: Number(top.similarity) } : null, composite: v.score };
}

export async function logGuard(supabase: Db, c: GuardInput, r: GuardResult, action: string) {
  await logDecision(supabase, {
    candidate_type: c.type, candidate_ref: c.slug, candidate_title: c.title,
    decision: r.decision, match_type: r.match?.type ?? null, match_ref: r.match?.ref ?? null,
    match_title: r.match?.title ?? null, similarity: r.match?.similarity ?? r.composite ?? null,
    signals: { barrier: r.barrier, reason: r.reason }, action_taken: action,
  });
}
export { recordVerdict };
