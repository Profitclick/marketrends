// Multi-signal semantic duplicate evaluation shared by generators.
import {
  embed, headlineSimilarity, overlapRatio, normalizeUrl, compositeScore,
  DUPLICATE_THRESHOLD, MERGE_THRESHOLD, logDecision, type DupeSignals,
} from "./semantic.ts";
import type { Db } from "./db.ts";

export type Candidate = {
  type: string;            // article | intent | knowledge | guide | comparison | report
  ref: string;             // slug or id
  title: string;
  text: string;            // full body used for embedding
  entities?: string[];     // entity slugs/names
  topics?: string[];       // topic slugs/names
  event?: string;          // short event descriptor (headline + date bucket)
  source_url?: string | null;
  canonical_url?: string | null;
  published_at?: string | null;
};

export type DupeVerdict = {
  decision: "unique" | "merge" | "duplicate";
  score: number;
  signals: DupeSignals | null;
  match: { content_type: string; ref: string; title: string; similarity: number } | null;
  embedding: number[];
  candidates: MatchRow[];
};

export type MatchRow = { content_type: string; ref: string; title: string | null; similarity: number };

type EnrichedRow = {
  title?: string | null; source_url?: string | null; canonical_url?: string | null;
  created_at?: string | null; tags?: string[] | null; category?: string | null;
};

const TABLE_BY_TYPE: Record<string, { table: string; slugCol: string; titleCol: string }> = {
  article: { table: "articles", slugCol: "slug", titleCol: "title" },
  knowledge: { table: "knowledge_pages", slugCol: "slug", titleCol: "title" },
  guide: { table: "guides", slugCol: "slug", titleCol: "title" },
  comparison: { table: "comparison_pages", slugCol: "slug", titleCol: "title" },
  report: { table: "research_reports", slugCol: "slug", titleCol: "title" },
  intent: { table: "search_intents", slugCol: "target_slug", titleCol: "keyword" },
};

async function enrichMatch(supabase: Db, m: MatchRow): Promise<EnrichedRow> {
  const cfg = TABLE_BY_TYPE[m.content_type];
  if (!cfg) return {};
  const cols = cfg.table === "articles"
    ? "id,title,source_url,created_at,tags,category"
    : `id,${cfg.titleCol},created_at`;
  const { data } = await supabase.from(cfg.table).select(cols).eq(cfg.slugCol, m.ref).maybeSingle();
  return (data || {}) as EnrichedRow;
}

export async function evaluateDuplicate(
  supabase: Db, apiKey: string, c: Candidate,
): Promise<DupeVerdict> {
  const embedding = await embed(`${c.title}\n\n${c.text}`, apiKey);

  const { data: matches, error } = await supabase.rpc("match_editorial_content", {
    query_embedding: embedding,
    match_threshold: 0.72,
    match_count: 8,
    exclude_ref: `${c.type}:${c.ref}`,
  });
  if (error) console.error("match_editorial_content", error);

  let best: DupeVerdict["match"] = null;
  let bestSignals: DupeSignals | null = null;
  let bestScore = 0;

  for (const m of (matches || []) as MatchRow[]) {
    const row = await enrichMatch(supabase, m);
    const matchTitle = m.title || row.title || "";
    const hoursApart = c.published_at && row.created_at
      ? Math.abs(new Date(c.published_at).getTime() - new Date(row.created_at).getTime()) / 36e5
      : null;

    const signals: DupeSignals = {
      semantic: Number(m.similarity) || 0,
      headline: headlineSimilarity(c.title, matchTitle),
      entity_overlap: overlapRatio(c.entities || [], row.tags || []),
      topic_overlap: overlapRatio(c.topics || [], [row.category].filter(Boolean)),
      event_similarity: c.event ? headlineSimilarity(c.event, matchTitle) : 0,
      same_source_url: !!(c.source_url && row.source_url && normalizeUrl(c.source_url) === normalizeUrl(row.source_url)),
      same_canonical_url: !!(c.canonical_url && row.canonical_url && normalizeUrl(c.canonical_url) === normalizeUrl(row.canonical_url)),
      hours_apart: hoursApart,
    };
    const score = compositeScore(signals);
    if (score > bestScore) {
      bestScore = score;
      bestSignals = signals;
      best = { content_type: m.content_type, ref: m.ref, title: matchTitle, similarity: Number(m.similarity) || 0 };
    }
  }

  const decision: DupeVerdict["decision"] =
    bestScore >= DUPLICATE_THRESHOLD ? "duplicate" : bestScore >= MERGE_THRESHOLD ? "merge" : "unique";

  return { decision, score: bestScore, signals: bestSignals, match: best, embedding, candidates: (matches || []) as MatchRow[] };
}

export async function recordVerdict(
  supabase: Db, c: Candidate, v: DupeVerdict, action: string,
) {
  await logDecision(supabase, {
    candidate_type: c.type,
    candidate_ref: c.ref,
    candidate_title: c.title,
    decision: v.decision,
    match_type: v.match?.content_type ?? null,
    match_ref: v.match?.ref ?? null,
    match_title: v.match?.title ?? null,
    similarity: Number(v.score.toFixed(4)),
    signals: v.signals || {},
    action_taken: action,
  });
}
