// Multi-signal semantic duplicate evaluation shared by generators.
import {
  embed, headlineSimilarity, overlapRatio, normalizeUrl, compositeScore,
  DUPLICATE_THRESHOLD, MERGE_THRESHOLD, logDecision, type DupeSignals,
} from "./semantic.ts";
import { str, strArr, type DbClient, type Row } from "./db.ts";

/** Row shape returned by the match_editorial_content RPC. */
export type MatchCandidate = {
  content_type: string;
  ref: string;
  title: string;
  similarity: number;
};

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
  candidates: MatchCandidate[];
};

const TABLE_BY_TYPE: Record<string, { table: string; slugCol: string; titleCol: string }> = {
  article: { table: "articles", slugCol: "slug", titleCol: "title" },
  knowledge: { table: "knowledge_pages", slugCol: "slug", titleCol: "title" },
  guide: { table: "guides", slugCol: "slug", titleCol: "title" },
  comparison: { table: "comparison_pages", slugCol: "slug", titleCol: "title" },
  report: { table: "research_reports", slugCol: "slug", titleCol: "title" },
  intent: { table: "search_intents", slugCol: "target_slug", titleCol: "keyword" },
};

async function enrichMatch(supabase: DbClient, m: MatchCandidate): Promise<Row> {
  const cfg = TABLE_BY_TYPE[m.content_type];
  if (!cfg) return {};
  const cols = cfg.table === "articles"
    ? "id,title,source_url,created_at,tags,category"
    : `id,${cfg.titleCol},created_at`;
  const { data } = await supabase.from(cfg.table).select(cols).eq(cfg.slugCol, m.ref).maybeSingle();
  return data || {};
}

export async function evaluateDuplicate(
  supabase: DbClient, apiKey: string, c: Candidate,
): Promise<DupeVerdict> {
  const embedding = await embed(`${c.title}\n\n${c.text}`, apiKey);

  const { data, error } = await supabase.rpc("match_editorial_content", {
    query_embedding: embedding,
    match_threshold: 0.72,
    match_count: 8,
    exclude_ref: `${c.type}:${c.ref}`,
  });
  if (error) console.error("match_editorial_content", error);
  const matches = (data || []) as unknown as MatchCandidate[];

  let best: DupeVerdict["match"] = null;
  let bestSignals: DupeSignals | null = null;
  let bestScore = 0;

  for (const m of matches) {
    const row = await enrichMatch(supabase, m);
    const matchTitle = m.title || str(row.title);
    const createdAt = str(row.created_at);
    const sourceUrl = str(row.source_url);
    const canonicalUrl = str(row.canonical_url);
    const hoursApart = c.published_at && createdAt
      ? Math.abs(new Date(c.published_at).getTime() - new Date(createdAt).getTime()) / 36e5
      : null;

    const signals: DupeSignals = {
      semantic: Number(m.similarity) || 0,
      headline: headlineSimilarity(c.title, matchTitle),
      entity_overlap: overlapRatio(c.entities || [], strArr(row.tags)),
      topic_overlap: overlapRatio(c.topics || [], str(row.category) ? [str(row.category)] : []),
      event_similarity: c.event ? headlineSimilarity(c.event, matchTitle) : 0,
      same_source_url: !!(c.source_url && sourceUrl && normalizeUrl(c.source_url) === normalizeUrl(sourceUrl)),
      same_canonical_url: !!(c.canonical_url && canonicalUrl && normalizeUrl(c.canonical_url) === normalizeUrl(canonicalUrl)),
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

  return { decision, score: bestScore, signals: bestSignals, match: best, embedding, candidates: matches };
}

export async function recordVerdict(
  supabase: DbClient, c: Candidate, v: DupeVerdict, action: string,
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
