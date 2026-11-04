// Compute Authority Scores for topics, entities, and clusters.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY = 86400000;
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return unauthorized(corsHeaders);
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const now = Date.now();

    // Clusters run first: cheap (one RPC) and must not be starved by the per-node loops below.
    // ----- Clusters -----
    // Membership comes ONLY from the canonical layer (article_clusters via cluster_membership_stats).
    // articles.category is an editorial field and is never used for cluster membership.
    const { data: cstats, error: cErr } = await supabase.rpc("cluster_membership_stats");
    if (cErr) throw cErr;
    for (const c of cstats || []) {
      const articles = Number(c.articles) || 0;
      const guides = Number(c.guides) || 0;
      const kp = Number(c.knowledge_pages) || 0;
      const cmp = Number(c.comparisons) || 0;
      const lastAt = c.last_article_at ? new Date(c.last_article_at).getTime() : 0;
      const freshDays = lastAt ? (now - lastAt) / DAY : 999;
      const freshBoost = Math.max(0, 15 - freshDays * 0.5);
      const momentum = Number(c.last_7d) || 0;
      const coverageGap = clamp((guides < 2 ? 30 : 0) + (kp < 2 ? 30 : 0) + (cmp < 1 ? 20 : 0));
      const authority = clamp(Math.log(articles + 1) * 15 + guides * 8 + kp * 10 + cmp * 6 + freshBoost);
      const opportunity = clamp(momentum * 6 + coverageGap * 0.6);

      await supabase.from("cluster_stats").upsert({
        slug: c.slug,
        name: c.name,
        authority_score: authority,
        opportunity_score: opportunity,
        articles,
        guides,
        knowledge_pages: kp,
        comparisons: cmp,
        internal_links: 0,
        freshness_days: freshDays,
        momentum,
        coverage_gap: coverageGap,
        updated_at: new Date().toISOString(),
      }, { onConflict: "slug" });
    }


    // ----- Topics -----
    const { data: topics } = await supabase
      .from("topics")
      .select("id, slug, article_count, articles_last_30d, last_article_at");
    let topicsUpdated = 0;
    for (const t of topics || []) {
      const articles = t.article_count || 0;
      const recent = t.articles_last_30d || 0;
      const fresh = t.last_article_at
        ? Math.max(0, 15 - ((now - new Date(t.last_article_at).getTime()) / DAY) * 0.5)
        : 0;
      const { count: relCount } = await supabase
        .from("topic_relations").select("*", { count: "exact", head: true }).eq("topic_id", t.id);
      const score = clamp(Math.log(articles + 1) * 15 + recent * 1.5 + (relCount || 0) * 0.8 + fresh);
      await supabase.from("topics").update({ authority_score: score }).eq("id", t.id);
      topicsUpdated++;
    }

    // ----- Entities -----
    const { data: entities } = await supabase
      .from("entities").select("id, mention_count");
    let entitiesUpdated = 0;
    for (const e of entities || []) {
      const m = e.mention_count || 0;
      const { count: relCount } = await supabase
        .from("entity_relations").select("*", { count: "exact", head: true }).eq("entity_id", e.id);
      const score = clamp(Math.log(m + 1) * 18 + (relCount || 0) * 1.2);
      await supabase.from("entities").update({ authority_score: score }).eq("id", e.id);
      entitiesUpdated++;
    }

    return new Response(JSON.stringify({
      ok: true, topics: topicsUpdated, entities: entitiesUpdated, clusters: (cstats || []).length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
