import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Progress = {
  total?: number;
  pending?: number;
  retry?: number;
  failed?: number;
  complete_with_relations?: number;
  complete_no_relations?: number;
  last_hour?: number;
  last_24h?: number;
  eta_hours?: number | null;
};

type Convergence = {
  total_eligible: number;
  enriched: number;
  embedded: number;
  enrichment_pct: number;
  embedding_pct: number;
  converged: boolean;
};

const Bar = ({ pct }: { pct: number }) => (
  <div className="h-2 w-full bg-muted" role="presentation">
    <div className="h-2 bg-primary transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
  </div>
);

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="border border-border p-3">
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
  </div>
);

/**
 * Phase 6.2B archive repair telemetry.
 * Read-only: reports factual enrichment/embedding coverage of the historical
 * corpus, measured throughput and ETA. No estimates are invented client-side —
 * everything comes from the database progress functions.
 */
export const ArchiveRepairPanel = () => {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [conv, setConv] = useState<Convergence | null>(null);
  const [candidates, setCandidates] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = supabase as any;
    const [p, c, m] = await Promise.all([
      sb.rpc("archive_backfill_progress"),
      sb.rpc("graph_convergence_status"),
      sb.from("node_merge_candidates").select("id", { count: "exact", head: true }).eq("status", "review"),
    ]);
    if (p.error || c.error) setErr(p.error?.message || c.error?.message || null);
    setProgress(p.data ?? null);
    setConv(c.data ?? null);
    setCandidates(m.count ?? null);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (err) {
    return <p className="text-sm text-muted-foreground">Kunne ikke laste arkivstatus: {err}</p>;
  }
  if (!progress || !conv) {
    return <p className="text-sm text-muted-foreground">Laster arkivstatus …</p>;
  }

  const remaining = (progress.pending ?? 0) + (progress.retry ?? 0);

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Arkivreparasjon</h3>
        <p className="text-sm text-muted-foreground">
          Historisk berikelse av hele arkivet. Kjører kontrollert i bakgrunnen; ingen ny
          innholdsgenerering skaleres opp før konvergens er nådd.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span>Berikelse</span>
          <span className="tabular-nums text-muted-foreground">
            {conv.enriched} / {conv.total_eligible} ({conv.enrichment_pct}%)
          </span>
        </div>
        <Bar pct={Number(conv.enrichment_pct)} />
        <div className="flex items-baseline justify-between text-sm">
          <span>Embeddings</span>
          <span className="tabular-nums text-muted-foreground">
            {conv.embedded} / {conv.total_eligible} ({conv.embedding_pct}%)
          </span>
        </div>
        <Bar pct={Number(conv.embedding_pct)} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Gjenstår" value={remaining} />
        <Stat label="Siste time" value={progress.last_hour ?? 0} />
        <Stat label="Siste 24t" value={progress.last_24h ?? 0} />
        <Stat
          label="Estimert ferdig"
          value={progress.eta_hours == null ? "—" : `${Math.round(progress.eta_hours)} t`}
        />
        <Stat label="Med relasjoner" value={progress.complete_with_relations ?? 0} />
        <Stat label="Uten relasjoner" value={progress.complete_no_relations ?? 0} />
        <Stat label="Feilet (oppgitt)" value={progress.failed ?? 0} />
        <Stat label="Til manuell fletting" value={candidates ?? 0} />
      </div>

      <p className="text-sm">
        {conv.converged ? (
          <span className="font-medium">
            Grafen er konvergert (≥95%). Full gjenoppbygging av statistikk og autoritet kan kjøres.
          </span>
        ) : (
          <span className="text-muted-foreground">
            Grafen er ikke konvergert ennå. Statistikk- og autoritetsberegninger kjører på delvis
            datagrunnlag og bør ikke tolkes som endelige.
          </span>
        )}
      </p>
    </section>
  );
};
