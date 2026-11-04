// Rebuild Entity Hub stats: trending counters, momentum, co-occurrence relations, daily metrics.
// Safe to re-run. Reads article_entities + articles, writes entities/entity_relations/entity_metrics.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return unauthorized(corsHeaders);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const now = Date.now();
    const d24 = new Date(now - 24 * 3600_000).toISOString();
    const d7 = new Date(now - 7 * 86400_000).toISOString();
    const d30 = new Date(now - 30 * 86400_000).toISOString();

    // Pull article_entities for the last 30 days joined with article publish dates
    const { data: ae, error } = await supabase
      .from("article_entities")
      .select("entity_id, article_id, created_at, articles!inner(id, created_at, published)")
      .gte("created_at", d30)
      .limit(20000);
    if (error) throw error;

    type Row = { entity_id: string; article_id: string; created_at: string };
    const rows = (ae || []) as unknown as Row[];

    // Aggregate per-entity counters + last mention
    const counters = new Map<string, { d24: number; d7: number; d30: number; last: string }>();
    const byArticle = new Map<string, Set<string>>();
    const byDay = new Map<string, Map<string, number>>(); // entity_id -> day -> count

    for (const r of rows) {
      const t = r.created_at;
      const c = counters.get(r.entity_id) || { d24: 0, d7: 0, d30: 0, last: t };
      if (t >= d24) c.d24++;
      if (t >= d7) c.d7++;
      c.d30++;
      if (t > c.last) c.last = t;
      counters.set(r.entity_id, c);

      const set = byArticle.get(r.article_id) || new Set<string>();
      set.add(r.entity_id);
      byArticle.set(r.article_id, set);

      const day = t.slice(0, 10);
      const m = byDay.get(r.entity_id) || new Map<string, number>();
      m.set(day, (m.get(day) || 0) + 1);
      byDay.set(r.entity_id, m);
    }

    // Update entity counters
    const updates: Promise<unknown>[] = [];
    for (const [id, c] of counters.entries()) {
      const momentum = c.d7 > 0 ? c.d24 / (c.d7 / 7) : c.d24;
      const trending = c.d24 * 3 + c.d7 + c.d30 * 0.2 + momentum * 2;
      updates.push(
        supabase.from("entities").update({
          mentions_last_24h: c.d24,
          mentions_last_7d: c.d7,
          mentions_last_30d: c.d30,
          momentum_score: Number(momentum.toFixed(3)),
          trending_score: Number(trending.toFixed(3)),
          last_mention_at: c.last,
          updated_at: new Date().toISOString(),
        }).eq("id", id),
      );
    }
    await Promise.all(updates);

    // Co-occurrence
    const pairs = new Map<string, number>();
    for (const set of byArticle.values()) {
      const ids = [...set];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i], b = ids[j];
          const k1 = `${a}|${b}`;
          const k2 = `${b}|${a}`;
          pairs.set(k1, (pairs.get(k1) || 0) + 1);
          pairs.set(k2, (pairs.get(k2) || 0) + 1);
        }
      }
    }

    const relRows = [...pairs.entries()].map(([k, count]) => {
      const [entity_id, related_entity_id] = k.split("|");
      return {
        entity_id,
        related_entity_id,
        co_occurrence_count: count,
        score: count,
        updated_at: new Date().toISOString(),
      };
    });

    // Batch upsert in chunks of 500
    for (let i = 0; i < relRows.length; i += 500) {
      const chunk = relRows.slice(i, i + 500);
      await supabase.from("entity_relations").upsert(chunk, { onConflict: "entity_id,related_entity_id" });
    }

    // Daily metrics
    const metricRows: { entity_id: string; day: string; mentions: number }[] = [];
    for (const [entity_id, m] of byDay.entries()) {
      for (const [day, mentions] of m.entries()) {
        metricRows.push({ entity_id, day, mentions });
      }
    }
    for (let i = 0; i < metricRows.length; i += 500) {
      const chunk = metricRows.slice(i, i + 500);
      await supabase.from("entity_metrics").upsert(chunk, { onConflict: "entity_id,day" });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        entities_updated: counters.size,
        relations_upserted: relRows.length,
        metrics_upserted: metricRows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
