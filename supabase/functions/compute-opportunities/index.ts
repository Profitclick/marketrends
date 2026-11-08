// Compute editorial opportunities from existing topic/entity signals.
// Writes/updates rows in public.opportunities with a 0-100 opportunity_score
// and recommends a content type (Knowledge > Guide > Comparison > Analysis > Entity).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";

// Commercial value weights per category (rough proxy until GSC/Ahrefs data arrives)
const CATEGORY_COMMERCIAL: Record<string, number> = {
  "Krypto & Trading": 85,
  "Finans & Marked": 80,
  "Teknologi & AI": 78,
  "Penger & Karriere": 72,
  "Gründer & Startups": 65,
  "Trender & Analyse": 55,
  "Guider & Forklart": 70,
  Crypto: 85, Tech: 78, Fintech: 82, Money: 72,
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

function recommendType(args: {
  hasKnowledge: boolean; hasGuide: boolean; hasComparison: boolean;
  articleCount: number; velocity: number; entityScore: number;
}): string {
  if (!args.hasKnowledge && args.articleCount >= 2) return "Knowledge Page";
  if (!args.hasGuide && args.velocity >= 1) return "Guide";
  if (!args.hasComparison && args.entityScore > 30) return "Comparison Page";
  if (args.velocity >= 2) return "News Analysis";
  return "Entity Expansion";
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
    // Pull top trending topics
    const { data: topics } = await supabase
      .from("topics")
      .select("id,name,slug,category,trending_score,velocity_score,momentum_score,articles_last_7d,articles_last_30d")
      .order("trending_score", { ascending: false })
      .limit(60);

    // Pull top trending entities
    const { data: entities } = await supabase
      .from("entities")
      .select("id,name,slug,entity_type,trending_score,velocity_score,momentum_score,mentions_last_7d,mentions_last_30d")
      .order("trending_score", { ascending: false })
      .limit(60);

    // Existing coverage maps (knowledge/guide/comparison) – best-effort lookups
    const { data: knowledge } = await supabase.from("knowledge_pages").select("topic_id, slug").limit(500);
    const { data: guides } = await supabase.from("guides").select("topic_id, slug").limit(500);
    const { data: comparisons } = await supabase.from("comparison_pages").select("slug").limit(500);

    const knowTopicIds = new Set((knowledge || []).map((r) => r.topic_id).filter(Boolean));
    const guideTopicIds = new Set((guides || []).map((r) => r.topic_id).filter(Boolean));
    const comparisonSlugs = new Set((comparisons || []).map((r) => r.slug));

    const rows: Record<string, unknown>[] = [];

    for (const t of topics || []) {
      const category = t.category || "Trender & Analyse";
      const commercial = CATEGORY_COMMERCIAL[category] ?? 50;
      const velocity = Number(t.velocity_score || 0);
      const momentum = Number(t.momentum_score || 0);
      const trend = Number(t.trending_score || 0);
      const coverage = (t.articles_last_30d || 0) >= 5 ? 80 : (t.articles_last_30d || 0) * 12;
      const competition = clamp(coverage * 0.6 + 20); // proxy
      const searchDemand = clamp(trend * 1.2 + (t.articles_last_7d || 0) * 4);
      const gap = clamp(100 - coverage);
      const opp = clamp(
        searchDemand * 0.30 +
        commercial * 0.25 +
        momentum * 8 * 0.15 +
        gap * 0.20 +
        velocity * 6 * 0.10,
      );

      rows.push({
        keyword: t.name,
        topic_id: t.id,
        category,
        source: "topics",
        search_intent: "informational",
        trend_score: trend,
        momentum_score: momentum,
        commercial_score: commercial,
        competition_score: competition,
        search_demand_score: searchDemand,
        coverage_score: coverage,
        geo_priority: 90, // NO-first
        opportunity_score: opp,
        recommended_content_type: recommendType({
          hasKnowledge: knowTopicIds.has(t.id),
          hasGuide: guideTopicIds.has(t.id),
          hasComparison: comparisonSlugs.has(t.slug),
          articleCount: t.articles_last_30d || 0,
          velocity, entityScore: 0,
        }),
        status: "new",
        metadata: { topic_slug: t.slug },
      });
    }

    for (const e of entities || []) {
      const commercial = CATEGORY_COMMERCIAL[e.entity_type || ""] ?? 60;
      const velocity = Number(e.velocity_score || 0);
      const momentum = Number(e.momentum_score || 0);
      const trend = Number(e.trending_score || 0);
      const coverage = (e.mentions_last_30d || 0) >= 5 ? 80 : (e.mentions_last_30d || 0) * 12;
      const searchDemand = clamp(trend * 1.2 + (e.mentions_last_7d || 0) * 4);
      const gap = clamp(100 - coverage);
      const opp = clamp(
        searchDemand * 0.30 +
        commercial * 0.25 +
        momentum * 8 * 0.15 +
        gap * 0.20 +
        velocity * 6 * 0.10,
      );
      rows.push({
        keyword: e.name,
        entity_id: e.id,
        category: e.entity_type || "Entity",
        source: "entities",
        search_intent: "navigational",
        trend_score: trend,
        momentum_score: momentum,
        commercial_score: commercial,
        competition_score: clamp(coverage * 0.6 + 25),
        search_demand_score: searchDemand,
        coverage_score: coverage,
        geo_priority: 85,
        opportunity_score: opp,
        recommended_content_type: recommendType({
          hasKnowledge: false, hasGuide: false,
          hasComparison: false, articleCount: e.mentions_last_30d || 0,
          velocity, entityScore: trend,
        }),
        status: "new",
        metadata: { entity_slug: e.slug, entity_type: e.entity_type },
      });
    }

    // Replace strategy: clear non-finalized 'new' rows then re-insert
    await supabase.from("opportunities").delete().eq("status", "new");

    let inserted = 0;
    // batch insert in chunks of 50
    for (let i = 0; i < rows.length; i += 50) {
      const slice = rows.slice(i, i + 50);
      const { error } = await supabase.from("opportunities").insert(slice);
      if (!error) inserted += slice.length;
    }

    return new Response(
      JSON.stringify({ ok: true, opportunities: inserted, topics: topics?.length || 0, entities: entities?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e_: unknown) { const e = e_ instanceof Error ? e_ : new Error(String(e_));
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
