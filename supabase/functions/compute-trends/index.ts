// Compute trend / velocity / momentum scores for topics and entities.
// Cheap aggregation, safe to re-run.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return unauthorized(corsHeaders);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const now = Date.now();
    const d24 = new Date(now - 86400_000).toISOString();
    const d7 = new Date(now - 7 * 86400_000).toISOString();
    const d30 = new Date(now - 30 * 86400_000).toISOString();

    // Topics
    const { data: at } = await supabase
      .from("article_topics")
      .select("topic_id, articles!inner(created_at, published)")
      .gte("created_at", d30)
      .limit(20000);

    const topicAgg = new Map<string, { c24: number; c7: number; c30: number }>();
    for (const r of (at || []) as any[]) {
      const t = r.articles?.created_at;
      if (!t) continue;
      const a = topicAgg.get(r.topic_id) || { c24: 0, c7: 0, c30: 0 };
      if (t >= d24) a.c24++; if (t >= d7) a.c7++; a.c30++;
      topicAgg.set(r.topic_id, a);
    }
    let topicsUpdated = 0;
    for (const [topic_id, a] of topicAgg) {
      const velocity = a.c24; // articles last 24h
      const avg = a.c7 / 7;
      const momentum = avg > 0 ? a.c24 / avg : a.c24;
      const trending = a.c24 * 3 + a.c7 + a.c30 * 0.2 + momentum * 2;
      await supabase.from("topics").update({
        articles_last_7d: a.c7, articles_last_30d: a.c30,
        velocity_score: velocity, momentum_score: momentum, trending_score: trending,
      }).eq("id", topic_id);
      topicsUpdated++;
    }

    // Entities
    const { data: ae } = await supabase
      .from("article_entities")
      .select("entity_id, created_at")
      .gte("created_at", d30)
      .limit(20000);

    const entAgg = new Map<string, { c24: number; c7: number; c30: number }>();
    for (const r of (ae || []) as any[]) {
      const a = entAgg.get(r.entity_id) || { c24: 0, c7: 0, c30: 0 };
      if (r.created_at >= d24) a.c24++; if (r.created_at >= d7) a.c7++; a.c30++;
      entAgg.set(r.entity_id, a);
    }
    let entitiesUpdated = 0;
    for (const [entity_id, a] of entAgg) {
      const velocity = a.c24;
      const avg = a.c7 / 7;
      const momentum = avg > 0 ? a.c24 / avg : a.c24;
      const trending = a.c24 * 3 + a.c7 + a.c30 * 0.2 + momentum * 2;
      await supabase.from("entities").update({
        mentions_last_24h: a.c24, mentions_last_7d: a.c7, mentions_last_30d: a.c30,
        velocity_score: velocity, momentum_score: momentum, trending_score: trending,
      }).eq("id", entity_id);
      entitiesUpdated++;
    }

    return new Response(JSON.stringify({ topicsUpdated, entitiesUpdated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e_: unknown) { const e = e_ instanceof Error ? e_ : new Error(String(e_));
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
