// Recompute topic stats: counts, freshness window, trending score, hero/explainer
// picks, and rebuild the topic_relations graph (Jaccard on shared articles + entities).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY = 86400000;

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
    const cutoff7 = new Date(now - 7 * DAY).toISOString();
    const cutoff30 = new Date(now - 30 * DAY).toISOString();

    const { data: topics } = await supabase.from("topics").select("id, name, slug, category_hint, meta_title, meta_description");
    let updated = 0;

    // Build per-topic article sets for relations later
    const topicArticleSets = new Map<string, Set<string>>();

    for (const t of topics || []) {
      const { data: rows } = await supabase
        .from("article_topics")
        .select("relevance_score, articles!inner(id, created_at, published, title, image_url, meta_description, article_type)")
        .eq("topic_id", t.id);

      const pub = (rows || []).filter((r) => r.articles?.published);
      const articleSet = new Set<string>(pub.map((r) => r.articles.id));
      topicArticleSets.set(t.id, articleSet);

      const count = pub.length;
      const dates = pub.map((r) => new Date(r.articles.created_at).getTime());
      const last_article_at = dates.length ? new Date(Math.max(...dates)).toISOString() : null;
      const articles_last_7d = dates.filter((d) => d >= now - 7 * DAY).length;
      const articles_last_30d = dates.filter((d) => d >= now - 30 * DAY).length;

      const recencyDays = last_article_at ? (now - new Date(last_article_at).getTime()) / DAY : 999;
      const recency_boost = Math.max(0, 14 - recencyDays) / 14; // 0..1
      const trending_score =
        0.5 * articles_last_7d +
        0.3 * Math.max(0, articles_last_30d - articles_last_7d) / 3 +
        2.0 * recency_boost;

      // Hero: highest-relevance published in last 14 days, fallback newest
      const recentSorted = [...pub].sort((a, b) => {
        const ar = a.articles.created_at >= cutoff7 ? 2 : a.articles.created_at >= cutoff30 ? 1 : 0;
        const br = b.articles.created_at >= cutoff7 ? 2 : b.articles.created_at >= cutoff30 ? 1 : 0;
        if (br !== ar) return br - ar;
        return (b.relevance_score || 0) - (a.relevance_score || 0);
      });
      const hero_article_id = recentSorted[0]?.articles.id || null;

      const explainer = pub
        .filter((r) => r.articles.article_type === "guide")
        .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))[0];
      const explainer_article_id = explainer?.articles.id || null;

      // Auto-generated meta if missing
      const meta_title = t.meta_title || `${t.name} – nyheter, analyse og forklaring | Marketrends.no`;
      const freshLabel = recencyDays < 1 ? "Oppdatert i dag" : recencyDays < 7 ? "Oppdatert denne uken" : "Oppdateres jevnlig";
      const meta_description = t.meta_description ||
        `Følg ${t.name} på Marketrends. ${count} artikler. ${freshLabel}. Norsk dekning av ${t.name.toLowerCase()}.`;

      await supabase.from("topics").update({
        article_count: count,
        last_article_at,
        articles_last_7d,
        articles_last_30d,
        trending_score,
        hero_article_id,
        explainer_article_id,
        meta_title,
        meta_description,
      }).eq("id", t.id);
      updated++;
    }

    // Update entity mention_count
    const { data: ents } = await supabase.from("entities").select("id");
    for (const e of ents || []) {
      const { count } = await supabase
        .from("article_entities").select("*", { count: "exact", head: true }).eq("entity_id", e.id);
      await supabase.from("entities").update({ mention_count: count || 0 }).eq("id", e.id);
    }

    // Rebuild topic_relations via Jaccard on shared articles + shared entities
    // Fetch entity sets per topic (entities that appear in topic's articles)
    const topicEntitySets = new Map<string, Set<string>>();
    for (const [topicId, articleSet] of topicArticleSets) {
      if (!articleSet.size) { topicEntitySets.set(topicId, new Set()); continue; }
      const { data: ae } = await supabase
        .from("article_entities").select("entity_id").in("article_id", [...articleSet]);
      topicEntitySets.set(topicId, new Set((ae || []).map((r) => r.entity_id)));
    }

    await supabase.from("topic_relations").delete().neq("topic_id", "00000000-0000-0000-0000-000000000000");

    const ids = [...topicArticleSets.keys()];
    const rels: { topic_id: string; related_topic_id: string; score: number }[] = [];
    for (const a of ids) {
      const aArts = topicArticleSets.get(a)!;
      const aEnts = topicEntitySets.get(a)!;
      if (!aArts.size) continue;
      const scored: { id: string; score: number }[] = [];
      for (const b of ids) {
        if (b === a) continue;
        const bArts = topicArticleSets.get(b)!;
        const bEnts = topicEntitySets.get(b)!;
        if (!bArts.size) continue;
        let sharedA = 0; for (const x of aArts) if (bArts.has(x)) sharedA++;
        let sharedE = 0; for (const x of aEnts) if (bEnts.has(x)) sharedE++;
        const unionA = aArts.size + bArts.size - sharedA;
        const unionE = (aEnts.size + bEnts.size - sharedE) || 1;
        const score = (sharedA / Math.max(1, unionA)) * 0.6 + (sharedE / unionE) * 0.4;
        if (score > 0) scored.push({ id: b, score });
      }
      scored.sort((x, y) => y.score - x.score);
      for (const r of scored.slice(0, 8)) {
        rels.push({ topic_id: a, related_topic_id: r.id, score: r.score });
      }
    }
    if (rels.length) {
      // Insert in chunks
      for (let i = 0; i < rels.length; i += 500) {
        await supabase.from("topic_relations").insert(rels.slice(i, i + 500));
      }
    }

    return new Response(JSON.stringify({ ok: true, topics_updated: updated, relations: rels.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
