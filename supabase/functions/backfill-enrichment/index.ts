// Backfill: enrich existing published articles in batches.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";
import { startRun, finishRun } from "../_shared/run-lock.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdmin(req);
  if (!auth.ok) return unauthorized(corsHeaders);
  const runId = await startRun(auth.supabase, "backfill-enrichment", 30);
  if (!runId) {
    return new Response(JSON.stringify({ ok: false, skipped: true, reason: "already running" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(50, Number(body.limit) || 20);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Queue-driven and idempotent: only articles that have never completed
    // enrichment, or that are queued for retry, are picked up. Newest first so
    // the live archive converges before the deep back catalogue.
    // 'failed' (>=5 attempts) and 'complete_*' rows are never re-processed.
    const { data: arts } = await supabase.from("articles")
      .select("id, enrichment_status")
      .eq("published", true)
      .in("enrichment_status", ["pending", "retry"])
      .order("enrichment_status", { ascending: true }) // retry before pending
      .order("enrich_priority", { ascending: false })  // authority/recency/link value
      .order("created_at", { ascending: false })
      .limit(limit);

    let enriched = 0, skipped = 0, failed = 0, retried = 0, rateLimited = 0;
    let budgetExhausted = false;
    const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-article`;

    const MAX_RETRIES = 5;       // exponential backoff: 2s, 4s, 8s, 16s, 32s
    const BASE_DELAY = 2000;
    const MAX_DELAY = 32000;

    for (const a of arts || []) {
      if (budgetExhausted) { skipped++; continue; }

      let success = false;
      let attempt = 0;
      let lastStatus = 0;

      while (attempt <= MAX_RETRIES && !success) {
        try {
          const r = await fetch(fnUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "x-cron-secret": Deno.env.get("CRON_SECRET") ?? "",
            },
            body: JSON.stringify({ article_id: a.id }),
          });
          lastStatus = r.status;
          if (r.ok) { success = true; break; }
          // Circuit breaker: the AI budget is exhausted. Retrying cannot help and
          // would only spin the whole batch, so abort the run and leave the queue
          // untouched for the next scheduled slot.
          if (r.status === 402) { budgetExhausted = true; break; }
          // Retry on 429 (rate limit) and 5xx (transient server errors)
          if (r.status === 429 || r.status >= 500) {
            if (r.status === 429) rateLimited++;
            if (attempt < MAX_RETRIES) {
              // Honor Retry-After header if present
              const retryAfter = Number(r.headers.get("retry-after")) * 1000;
              const backoff = Math.min(MAX_DELAY, BASE_DELAY * Math.pow(2, attempt));
              const jitter = Math.floor(Math.random() * 500);
              const delay = Math.max(retryAfter || 0, backoff) + jitter;
              await sleep(delay);
              attempt++;
              retried++;
              continue;
            }
          }
          break; // non-retryable error
        } catch {
          if (attempt < MAX_RETRIES) {
            const backoff = Math.min(MAX_DELAY, BASE_DELAY * Math.pow(2, attempt));
            await sleep(backoff);
            attempt++;
            retried++;
            continue;
          }
          break;
        }
      }

      if (success) enriched++;
      else if (budgetExhausted) skipped++;
      else failed++;
      if (budgetExhausted) break;
      await sleep(2000);
    }


    await finishRun(auth.supabase, runId, failed > 0 || budgetExhausted ? "partial" : "success", {
      processed: arts?.length || 0, updated: enriched, failed, retry_count: retried,
      details: { skipped, rate_limited: rateLimited, budget_exhausted: budgetExhausted },
    }, budgetExhausted ? "AI budget exhausted (402) — run aborted, queue preserved" : undefined);

    return new Response(JSON.stringify({ ok: true, run_id: runId, enriched, skipped, failed, retried, rate_limited: rateLimited, budget_exhausted: budgetExhausted, total: arts?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    await finishRun(auth.supabase, runId, "failed", {}, e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
