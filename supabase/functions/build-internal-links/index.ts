// Build internal link graph across articles, topics, entities, guides, knowledge, comparisons, clusters.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cluster membership is read from the canonical layer (cluster_definitions / article_clusters /
// cluster_seed_nodes). No local category→cluster map.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return unauthorized(corsHeaders);
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const rows: any[] = [];
    const add = (source_type: string, source_slug: string, target_type: string, target_slug: string, anchor: string, relevance_score = 1) => {
      if (!source_slug || !target_slug) return;
      if (source_type === target_type && source_slug === target_slug) return;
      rows.push({ source_type, source_slug, target_type, target_slug, anchor, relevance_score });
    };

    // Articles → topics & entities (top-N each)
    const { data: articles } = await supabase
      .from("articles")
      .select("id, slug, title, category, content")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(500);

    const { data: topics } = await supabase.from("topics").select("id, slug, name");
    const { data: entities } = await supabase.from("entities").select("id, slug, name");
    const articleIds = (articles || []).map((a: any) => a.id);
    // Batched fetch (was 2 queries per article → exceeded the function time limit).
    const clustersByArticle = new Map<string, string[]>();
    const topicsByArticle = new Map<string, any[]>();
    const entitiesByArticle = new Map<string, any[]>();
    const push = (m: Map<string, any[]>, k: string, v: any) => { const l = m.get(k) || []; l.push(v); m.set(k, l); };
    for (let i = 0; i < articleIds.length; i += 100) {
      const ids = articleIds.slice(i, i + 100);
      const [{ data: mRows }, { data: atRows }, { data: aeRows }] = await Promise.all([
        supabase.from("article_clusters").select("article_id, cluster_slug").in("article_id", ids).limit(5000),
        supabase.from("article_topics").select("article_id, topic_id").in("article_id", ids).order("relevance_score", { ascending: false }).limit(5000),
        supabase.from("article_entities").select("article_id, entity_id").in("article_id", ids).order("mention_count", { ascending: false }).limit(5000),
      ]);
      for (const r of mRows || []) push(clustersByArticle, r.article_id, r.cluster_slug);
      for (const r of atRows || []) push(topicsByArticle, r.article_id, r);
      for (const r of aeRows || []) push(entitiesByArticle, r.article_id, r);
    }
    const topicMap = new Map((topics || []).map((t: any) => [t.id, t]));
    const entityMap = new Map((entities || []).map((e: any) => [e.id, e]));

    for (const a of articles || []) {
      const at = (topicsByArticle.get(a.id) || []).slice(0, 5);
      const ae = (entitiesByArticle.get(a.id) || []).slice(0, 5);
      for (const r of at || []) {
        const t = topicMap.get(r.topic_id);
        if (t) add("article", a.slug, "topic", (t as any).slug, (t as any).name, 0.8);
      }
      for (const r of ae || []) {
        const e = entityMap.get(r.entity_id);
        if (e) add("article", a.slug, "entity", (e as any).slug, (e as any).name, 0.7);
      }
      // article → cluster
      for (const cs of clustersByArticle.get(a.id) || []) add("article", a.slug, "cluster", cs, cs, 0.5);
    }

    // Topic → top related topics + entities
    const { data: topicRels } = await supabase
      .from("topic_relations")
      .select("topic_id, related_topic_id, strength")
      .order("strength", { ascending: false })
      .limit(2000);
    for (const r of topicRels || []) {
      const a = topicMap.get(r.topic_id);
      const b = topicMap.get(r.related_topic_id);
      if (a && b) add("topic", (a as any).slug, "topic", (b as any).slug, (b as any).name, Number(r.strength) || 0.5);
    }

    // Entity → related entities
    const { data: entityRels } = await supabase
      .from("entity_relations")
      .select("entity_id, related_entity_id, strength")
      .order("strength", { ascending: false })
      .limit(2000);
    for (const r of entityRels || []) {
      const a = entityMap.get(r.entity_id);
      const b = entityMap.get(r.related_entity_id);
      if (a && b) add("entity", (a as any).slug, "entity", (b as any).slug, (b as any).name, Number(r.strength) || 0.5);
    }

    // Cluster → guides (guide_categories), knowledge & comparisons (via canonical seed topics/entities)
    const { data: defs } = await supabase.from("cluster_definitions").select("slug, guide_categories");
    const { data: seeds } = await supabase.from("cluster_seed_nodes").select("cluster_slug, node_type, node_id").limit(5000);
    const { data: kps } = await supabase.from("knowledge_pages").select("slug, title, topic_id, entity_id").eq("published", true);
    const { data: cmps } = await supabase.from("comparison_pages").select("slug, title, entity_a_id, entity_b_id").eq("published", true);
    for (const d of defs || []) {
      const seedSet = new Set((seeds || []).filter((s: any) => s.cluster_slug === d.slug).map((s: any) => `${s.node_type}:${s.node_id}`));
      const gcats: string[] = d.guide_categories || [];
      if (gcats.length) {
        const { data: gs } = await supabase.from("guides").select("slug, title").eq("published", true).in("category", gcats).limit(10);
        for (const g of gs || []) add("cluster", d.slug, "guide", g.slug, g.title, 0.9);
      }
      for (const k of kps || []) {
        if (seedSet.has(`topic:${k.topic_id}`) || seedSet.has(`entity:${k.entity_id}`)) add("cluster", d.slug, "knowledge", k.slug, k.title, 0.9);
      }
      for (const cm of cmps || []) {
        if (seedSet.has(`entity:${cm.entity_a_id}`) || seedSet.has(`entity:${cm.entity_b_id}`)) add("cluster", d.slug, "comparison", cm.slug, cm.title, 0.9);
      }
    }

    // Bulk upsert in chunks
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from("internal_links").upsert(chunk, {
        onConflict: "source_type,source_slug,target_type,target_slug",
      });
      if (!error) inserted += chunk.length;
    }

    return new Response(JSON.stringify({ ok: true, processed: rows.length, inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
