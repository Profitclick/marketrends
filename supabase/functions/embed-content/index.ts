// Batch-generate embeddings for all editorial content types.
// POST { table?: string, batch?: number, all?: boolean }
// Without `table`, walks every configured table once with `batch` rows each.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAdmin } from "../_shared/admin-auth.ts";
import { embedBatch } from "../_shared/semantic.ts";

type Cfg = { table: string; select: string; text: (r: any) => string; filter?: (q: any) => any };

const TABLES: Cfg[] = [
  {
    table: "articles",
    select: "id,title,meta_description,content,category,tags",
    text: (r) => [r.title, r.category, (r.tags || []).join(", "), r.meta_description, r.content].filter(Boolean).join("\n\n"),
    filter: (q) => q.eq("published", true),
  },
  { table: "knowledge_pages", select: "id,title,summary,content,category", text: (r) => [r.title, r.category, r.summary, r.content].filter(Boolean).join("\n\n") },
  { table: "guides", select: "id,title,summary,content,category", text: (r) => [r.title, r.category, r.summary, r.content].filter(Boolean).join("\n\n") },
  { table: "comparison_pages", select: "id,title,summary,content,entity_a,entity_b", text: (r) => [r.title, `${r.entity_a} vs ${r.entity_b}`, r.summary, r.content].filter(Boolean).join("\n\n") },
  { table: "research_reports", select: "id,title,summary,body,category", text: (r) => [r.title, r.category, r.summary, r.body].filter(Boolean).join("\n\n") },
  {
    table: "search_intents",
    select: "id,keyword,template,intent_type,search_cluster,meta,geo_blocks",
    text: (r) => [r.keyword, r.search_cluster, r.meta?.summary, r.meta?.content, r.geo_blocks?.quick_answer].filter(Boolean).join("\n\n"),
    filter: (q) => q.eq("content_status", "published"),
  },
];

const BATCH_LIMIT = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = auth.supabase;
  const key = Deno.env.get("LOVABLE_API_KEY")!;

  try {
    const body = await req.json().catch(() => ({}));
    const batch = Math.min(Number(body.batch) || BATCH_LIMIT, 100);
    const only = body.table as string | undefined;
    const passes = Math.min(Number(body.passes) || 1, 20);
    const cfgs = only ? TABLES.filter((t) => t.table === only) : TABLES;

    const result: Record<string, { embedded: number; remaining: number; error?: string }> = {};

    for (const cfg of cfgs) {
      let embedded = 0;
      for (let p = 0; p < passes; p++) {
        let q = supabase.from(cfg.table).select(cfg.select).is("embedding", null).limit(batch);
        if (cfg.filter) q = cfg.filter(q);
        const { data: rows, error } = await q;
        if (error) { result[cfg.table] = { embedded, remaining: -1, error: error.message }; break; }
        if (!rows?.length) break;

        const texts = rows.map((r: any) => cfg.text(r) || "n/a");
        try {
          const vectors = await embedBatch(texts, key);
          const now = new Date().toISOString();
          for (let i = 0; i < rows.length; i++) {
            await supabase.from(cfg.table)
              .update({ embedding: vectors[i] as any, embedded_at: now })
              .eq("id", (rows[i] as any).id);
          }
          embedded += rows.length;
        } catch (e: any) {
          result[cfg.table] = { embedded, remaining: -1, error: String(e?.message || e).slice(0, 300) };
          break;
        }
        if (rows.length < batch) break;
      }
      let cq = supabase.from(cfg.table).select("*", { count: "exact", head: true }).is("embedding", null);
      if (cfg.filter) cq = cfg.filter(cq);
      const { count } = await cq;
      result[cfg.table] = { ...(result[cfg.table] || {}), embedded, remaining: count || 0 };
    }

    const totalRemaining = Object.values(result).reduce((a, r) => a + Math.max(0, r.remaining), 0);
    return new Response(JSON.stringify({ result, totalRemaining, complete: totalRemaining === 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
