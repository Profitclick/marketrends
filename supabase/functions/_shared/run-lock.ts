/** Run journal + exclusive locking for scheduled pipeline jobs. */
import type { DbClient } from "./db.ts";

export type RunMetrics = {
  processed?: number;
  published?: number;
  updated?: number;
  duplicates_blocked?: number;
  failed?: number;
  retry_count?: number;
  details?: Record<string, unknown>;
};

/** Returns a run id, or null when another run of the same job is in flight. */
export async function startRun(
  supabase: DbClient, job: string, staleMinutes = 30,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("start_pipeline_run", {
    _job: job, _stale_minutes: staleMinutes,
  });
  if (error) { console.error("start_pipeline_run", error); return null; }
  return (data as string | null) ?? null;
}

export async function finishRun(
  supabase: DbClient, id: string | null, status: "success" | "partial" | "failed",
  m: RunMetrics = {}, error?: string,
) {
  if (!id) return;
  const { error: e } = await supabase.rpc("complete_pipeline_run", {
    _id: id,
    _status: status,
    _processed: m.processed ?? 0,
    _published: m.published ?? 0,
    _updated: m.updated ?? 0,
    _duplicates_blocked: m.duplicates_blocked ?? 0,
    _failed: m.failed ?? 0,
    _retry_count: m.retry_count ?? 0,
    _error: error ? String(error).slice(0, 2000) : null,
    _details: m.details ?? {},
  });
  if (e) console.error("complete_pipeline_run", e);
}

export function lockedResponse(job: string, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ ok: false, skipped: true, reason: `${job} already running` }),
    { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
