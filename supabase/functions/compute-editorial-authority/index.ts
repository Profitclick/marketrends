// Editorial Authority Score — scores 0-100 per article from existing DB signals.
// No external calls. Idempotent. Safe to run repeatedly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OFFICIAL_DOMAINS = [
  "reuters.com", "apnews.com", "bloomberg.com", "ft.com", "sec.gov",
  "ec.europa.eu", "norges-bank.no", "ssb.no", "nav.no", "brreg.no",
  "innovasjonnorge.no", "digdir.no", "eurostat.ec.europa.eu", "ecb.europa.eu",
];

const NO_KEYWORDS = [
  "norge", "norsk", "nordmenn", "nok", "oslo børs", "ssb", "norges bank",
  "brønnøysund", "nav ", "kronen", "regjeringen", "stortinget",
];

type ScoredArticle = {
  sources?: unknown; entities?: unknown; topics?: unknown; ingress?: string | null;
  key_takeaways?: unknown; faq?: unknown; [k: string]: unknown;
};

function scoreArticle(a: ScoredArticle, inboundLinks: number) {
  const sources: { url?: string }[] = Array.isArray(a.sources) ? a.sources : [];
  const officialCount = sources.filter((s) => {
    const url = (s?.url || "").toLowerCase();
    return OFFICIAL_DOMAINS.some((d) => url.includes(d));
  }).length;
  const sourceScore = Math.min(20, sources.length * 4) + Math.min(10, officialCount * 5);

  const linkScore = Math.min(15, inboundLinks * 3);

  const entities = Array.isArray(a.entities) ? a.entities.length : 0;
  const topics = Array.isArray(a.topics) ? a.topics.length : 0;
  const coverageScore = Math.min(15, entities * 2 + topics * 2);

  const hasIngress = !!(a.ingress && String(a.ingress).length > 60);
  const hasKT = Array.isArray(a.key_takeaways) && a.key_takeaways.length >= 3;
  const hasFaq = Array.isArray(a.faq) && a.faq.length >= 2;
  const hasSources = sources.length >= 2;
  const schemaScore = (hasIngress ? 4 : 0) + (hasKT ? 4 : 0) + (hasFaq ? 4 : 0) + (hasSources ? 3 : 0);

  const updated = a.updated_at || a.published_at || a.created_at;
  const ageDays = updated ? (Date.now() - new Date(updated).getTime()) / 86400000 : 999;
  const freshnessScore = ageDays < 7 ? 10 : ageDays < 30 ? 7 : ageDays < 90 ? 4 : ageDays < 365 ? 2 : 0;

  const text = `${a.title || ""} ${a.ingress || ""} ${a.body || ""}`.toLowerCase();
  const noHits = NO_KEYWORDS.reduce((n, k) => n + (text.includes(k) ? 1 : 0), 0);
  const norwegianScore = Math.min(10, noHits * 2);

  const body = String(a.body || "");
  const sentences = body.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgLen = sentences.length ? body.length / sentences.length : 0;
  const readabilityScore = avgLen > 0 && avgLen < 180 ? 5 : avgLen < 260 ? 3 : 1;

  const total = Math.min(100,
    sourceScore + linkScore + coverageScore + schemaScore + freshnessScore + norwegianScore + readabilityScore
  );

  return {
    total: Math.round(total),
    breakdown: {
      sources: sourceScore, links: linkScore, coverage: coverageScore,
      schema: schemaScore, freshness: freshnessScore,
      norwegian: norwegianScore, readability: readabilityScore,
      counts: { sources: sources.length, official: officialCount, inboundLinks, entities, topics },
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return unauthorized(corsHeaders);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const limit = Math.min(500, Number(url.searchParams.get("limit") || 200));

    const { data: articles, error } = await supabase
      .from("articles")
      .select("id, title, slug, ingress, body, sources, key_takeaways, faq, published_at, updated_at, created_at")
      .eq("published", true)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    // Preload inbound link counts and topic/entity relations
    const slugs = (articles || []).map((a) => a.slug);
    const [{ data: links }, { data: at }, { data: ae }] = await Promise.all([
      supabase.from("internal_links").select("target_slug").in("target_slug", slugs).eq("target_type", "article"),
      supabase.from("article_topics").select("article_id, topic_id").in("article_id", (articles || []).map((a) => a.id)),
      supabase.from("article_entities").select("article_id, entity_id").in("article_id", (articles || []).map((a) => a.id)),
    ]);

    const linkCount = new Map<string, number>();
    (links || []).forEach((l) => linkCount.set(l.target_slug, (linkCount.get(l.target_slug) || 0) + 1));
    const topicCount = new Map<string, number>();
    (at || []).forEach((r) => topicCount.set(r.article_id, (topicCount.get(r.article_id) || 0) + 1));
    const entityCount = new Map<string, number>();
    (ae || []).forEach((r) => entityCount.set(r.article_id, (entityCount.get(r.article_id) || 0) + 1));

    let updated = 0;
    for (const a of articles || []) {
      const enriched = {
        ...a,
        entities: Array.from({ length: entityCount.get(a.id) || 0 }),
        topics: Array.from({ length: topicCount.get(a.id) || 0 }),
      };
      const { total, breakdown } = scoreArticle(enriched, linkCount.get(a.slug) || 0);
      const { error: uerr } = await supabase
        .from("articles")
        .update({
          editorial_authority_score: total,
          authority_breakdown: breakdown,
          last_scored_at: new Date().toISOString(),
        })
        .eq("id", a.id);
      if (!uerr) updated++;
    }

    return new Response(JSON.stringify({ ok: true, scored: updated, total: articles?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
