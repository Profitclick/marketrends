// Lightweight content orchestrator. Reads top opportunities and dispatches
// the recommended generator (knowledge/guide/comparison) using existing
// generator edge functions. Conservative: max 3 invocations per run.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAdmin, unauthorized, internalHeaders } from "../_shared/admin-auth.ts";
import { startRun, finishRun, lockedResponse } from "../_shared/run-lock.ts";

const MAX_PER_RUN = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return unauthorized(corsHeaders);
  const supabase = gate.supabase;
  const base = Deno.env.get("SUPABASE_URL")!;
  const runId = await startRun(supabase, "orchestrate-content", 30);
  if (!runId) return lockedResponse("orchestrate-content", corsHeaders);

  try {
    const { data } = await supabase
      .from("opportunities")
      .select("*")
      .eq("status", "new")
      .order("opportunity_score", { ascending: false })
      .limit(MAX_PER_RUN);

    const dispatched: { id: string; keyword: string; type: string; endpoint: string | null }[] = [];
    for (const opp of data || []) {
      const type = opp.recommended_content_type;
      let endpoint: string | null = null;
      if (type === "Knowledge Page") endpoint = "generate-knowledge-pages";
      else if (type === "Guide") endpoint = "generate-guides";
      else if (type === "Comparison Page") endpoint = "generate-comparisons";

      if (endpoint) {
        try {
          await fetch(`${base}/functions/v1/${endpoint}`, {
            method: "POST",
            headers: internalHeaders(),
            body: JSON.stringify({
              opportunityId: opp.id,
              keyword: opp.keyword,
              topicId: opp.topic_id,
              entityId: opp.entity_id,
              category: opp.category,
            }),
          });
        } catch (_) { /* swallow – mark in_progress anyway */ }
      }

      await supabase
        .from("opportunities")
        .update({ status: endpoint ? "in_progress" : "queued" })
        .eq("id", opp.id);

      dispatched.push({ id: opp.id, keyword: opp.keyword, type, endpoint });
      await new Promise((r) => setTimeout(r, 3000)); // 3s safety delay
    }

    await finishRun(supabase, runId, "success", { processed: dispatched.length, details: { dispatched } });

    return new Response(JSON.stringify({ ok: true, run_id: runId, dispatched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e_: unknown) { const e = e_ instanceof Error ? e_ : new Error(String(e_));
    await finishRun(supabase, runId, "failed", {}, e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
