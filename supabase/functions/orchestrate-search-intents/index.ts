// End-to-end search-intent production pipeline.
// Sequence:
//   1) compute-search-intents  → refresh backlog + prioritize
//   2) generate-search-intent-page (batch: pillars first, then supporting)
//   3) build-internal-links    → refresh cross-surface link graph
//   4) compute-editorial-authority → rescore
// Returns a production-readiness report.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin, unauthorized, internalHeaders } from "../_shared/admin-auth.ts";
import { startRun, finishRun, lockedResponse } from "../_shared/run-lock.ts";

async function invoke(base: string, key: string, fn: string, body: any = {}) {
  try {
    const res = await fetch(`${base}/functions/v1/${fn}`, {
      method: "POST",
      headers: internalHeaders(),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
    catch { return { ok: res.ok, status: res.status, data: text }; }
  } catch (e_: unknown) { const e = e_ instanceof Error ? e_ : new Error(String(e_)); return { ok: false, error: String(e?.message || e) }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return unauthorized(corsHeaders);
  const base = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = gate.supabase;
  const runId = await startRun(supabase, "orchestrate-search-intents", 45);
  if (!runId) return lockedResponse("orchestrate-search-intents", corsHeaders);

  try {
    const body = await req.json().catch(() => ({}));
    const perBatch = Math.min(Number(body.batchSize) || 3, 8);
    const maxPillars = Math.min(Number(body.maxPillars) || 2, 5);
    const maxSupporting = Math.min(Number(body.maxSupporting) || 3, 8);

    const report: any = { steps: [] };

    // Step 0 — make sure existing content is embedded so semantic dedup has a corpus
    const s0 = await invoke(base, key, "embed-content", { batch: 20, passes: Number(body.embedPasses) || 2 });
    report.steps.push({ step: "embed-content", ...s0 });

    // Step 1 — backlog refresh
    const s1 = await invoke(base, key, "compute-search-intents", {});
    report.steps.push({ step: "compute-search-intents", ...s1 });


    // Step 2a — generate pillars first (top priority, is_pillar=true, pending)
    const { data: pillarIds } = await supabase.from("search_intents")
      .select("id").eq("is_pillar", true).in("content_status", ["pending","queued"])
      .order("priority_score", { ascending: false }).limit(maxPillars);
    if (pillarIds?.length) {
      const s2a = await invoke(base, key, "generate-search-intent-page", {
        ids: pillarIds.map((r) => r.id).slice(0, perBatch),
      });
      report.steps.push({ step: "generate-pillars", ...s2a });
    }

    // Step 2b — supporting
    const s2b = await invoke(base, key, "generate-search-intent-page", { limit: maxSupporting });
    report.steps.push({ step: "generate-supporting", ...s2b });

    // Step 2c — orphan repair: every supporting intent must belong to a pillar
    const { data: allPillars } = await supabase.from("search_intents")
      .select("id, search_cluster").eq("is_pillar", true);
    const pillarByCluster = new Map((allPillars || []).map((p) => [p.search_cluster, p.id]));
    let orphansFixed = 0;
    for (const [cluster, pid] of pillarByCluster) {
      if (!cluster) continue;
      const { count } = await supabase.from("search_intents")
        .update({ pillar_intent_id: pid }, { count: "exact" })
        .eq("search_cluster", cluster).eq("is_pillar", false).is("pillar_intent_id", null);
      orphansFixed += count || 0;
    }
    const { count: orphansLeft } = await supabase.from("search_intents")
      .select("*", { count: "exact", head: true })
      .eq("is_pillar", false).is("pillar_intent_id", null);
    report.steps.push({ step: "orphan-repair", orphansFixed, orphansRemaining: orphansLeft || 0 });

    // Step 3 — internal-link graph refresh
    const s3 = await invoke(base, key, "build-internal-links", {});
    report.steps.push({ step: "build-internal-links", ...s3 });


    // Step 4 — recompute authority for touched articles (best-effort)
    const s4 = await invoke(base, key, "compute-editorial-authority", { limit: 50 });
    report.steps.push({ step: "compute-editorial-authority", ...s4 });

    // Step 5 — production readiness snapshot
    const [published, pending, failed, skipped, pillarsPub, avgQ, avgPrio] = await Promise.all([
      supabase.from("search_intents").select("*", { count: "exact", head: true }).eq("content_status", "published"),
      supabase.from("search_intents").select("*", { count: "exact", head: true }).eq("content_status", "pending"),
      supabase.from("search_intents").select("*", { count: "exact", head: true }).eq("content_status", "failed"),
      supabase.from("search_intents").select("*", { count: "exact", head: true }).eq("content_status", "skipped"),
      supabase.from("search_intents").select("*", { count: "exact", head: true }).eq("is_pillar", true).eq("content_status", "published"),
      supabase.from("search_intents").select("quality_score").eq("content_status", "published").limit(1000),
      supabase.from("search_intents").select("priority_score").in("content_status", ["pending","published"]).limit(1000),
    ]);
    const avg = (rows: any[] | null, k: string) => {
      const vals = (rows || []).map((r) => Number(r[k] || 0)).filter((n: number) => !isNaN(n));
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    };

    const { count: semanticDupes } = await supabase.from("duplicate_decisions")
      .select("*", { count: "exact", head: true }).eq("decision", "duplicate");
    const { count: mergesDone } = await supabase.from("duplicate_decisions")
      .select("*", { count: "exact", head: true }).eq("decision", "merge");

    report.snapshot = {
      published: published.count || 0,
      pending: pending.count || 0,
      failed: failed.count || 0,
      duplicates_prevented: skipped.count || 0,
      semantic_duplicates_logged: semanticDupes || 0,
      merges_performed: mergesDone || 0,
      orphan_intents: orphansLeft || 0,
      pillars_published: pillarsPub.count || 0,
      avg_quality: avg(avgQ.data as any, "quality_score"),
      avg_priority: avg(avgPrio.data as any, "priority_score"),
    };
    report.production_ready = (report.snapshot.published >= 3 && report.snapshot.avg_quality >= 70 && (orphansLeft || 0) === 0);


    report.run_id = runId;
    await finishRun(supabase, runId, report.production_ready ? "success" : "partial", {
      published: report.snapshot.published,
      duplicates_blocked: report.snapshot.duplicates_prevented,
      updated: report.snapshot.merges_performed,
      failed: report.snapshot.failed,
      details: report.snapshot,
    });

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e_: unknown) { const e = e_ instanceof Error ? e_ : new Error(String(e_));
    await finishRun(supabase, runId, "failed", {}, e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
