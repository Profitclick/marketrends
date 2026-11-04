import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlayCircle, RefreshCw, Rocket, Target, Braces, Copy } from "lucide-react";
import { toast } from "sonner";

type Intent = {
  id: string; keyword: string; template: string; intent_type: string;
  search_cluster: string | null; priority_score: number; content_status: string;
  target_slug: string | null; is_pillar: boolean; last_generated_at: string | null;
  quality_score?: number; commercial_score?: number; demand_score?: number;
  coverage_score?: number; duplicate_of?: string | null; embedded_at?: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-muted text-foreground",
  queued: "bg-blue-500/15 text-blue-700",
  generating: "bg-yellow-500/20 text-yellow-800",
  published: "bg-green-500/15 text-green-700",
  failed: "bg-destructive/15 text-destructive",
  skipped: "bg-muted text-muted-foreground line-through",
};

const STATUSES = ["pending", "queued", "generating", "published", "failed", "skipped"];
const TYPES = ["informational", "commercial", "transactional", "comparison"];

export const SearchIntentPanel = () => {
  const [rows, setRows] = useState<Intent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [metrics, setMetrics] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [cluster, setCluster] = useState<string>("all");
  const [pillarsOnly, setPillarsOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("search_intents")
      .select("id,keyword,template,intent_type,search_cluster,priority_score,content_status,target_slug,is_pillar,last_generated_at,quality_score,commercial_score,demand_score,coverage_score,duplicate_of,embedded_at")
      .order("priority_score", { ascending: false })
      .limit(300);
    setRows(data || []);

    const c: Record<string, number> = {};
    await Promise.all(STATUSES.map(async (s) => {
      const { count } = await (supabase as any).from("search_intents")
        .select("*", { count: "exact", head: true }).eq("content_status", s);
      c[s] = count || 0;
    }));
    setCounts(c);

    const { data: pub } = await (supabase as any).from("search_intents")
      .select("quality_score,commercial_score,demand_score,priority_score,search_cluster,is_pillar,embedded_at")
      .eq("content_status", "published").limit(1000);
    const avg = (arr: any[], k: string) => {
      const v = arr.map((r) => Number(r[k] || 0)).filter((n) => !isNaN(n));
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
    };
    const clusters = new Set((pub || []).map((r: any) => r.search_cluster).filter(Boolean));
    const pillarsPub = (pub || []).filter((r: any) => r.is_pillar).length;
    const embedded = (pub || []).filter((r: any) => r.embedded_at).length;

    // Duplicate engine telemetry
    const [dupRes, mergeRes, orphanRes] = await Promise.all([
      (supabase as any).from("duplicate_decisions").select("*", { count: "exact", head: true }).eq("decision", "duplicate"),
      (supabase as any).from("duplicate_decisions").select("*", { count: "exact", head: true }).eq("decision", "merge"),
      (supabase as any).from("search_intents").select("*", { count: "exact", head: true })
        .eq("is_pillar", false).is("pillar_intent_id", null),
    ]);

    setMetrics({
      avg_quality: avg(pub || [], "quality_score"),
      avg_commercial: avg(pub || [], "commercial_score"),
      avg_demand: avg(pub || [], "demand_score"),
      avg_priority: avg(pub || [], "priority_score"),
      clusters_covered: clusters.size,
      pillars_published: pillarsPub,
      embed_coverage: (pub || []).length ? Math.round((embedded / (pub || []).length) * 100) : 0,
      dupes_blocked: dupRes?.count || 0,
      merges: mergeRes?.count || 0,
      orphans: orphanRes?.count || 0,
    });

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const call = async (id: string, name: string, body: any = {}) => {
    setBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke(name, { body });
      if (error) throw error;
      toast.success(`${name}: ${JSON.stringify(data).slice(0, 140)}`);
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const clusters = useMemo(
    () => Array.from(new Set(rows.map((r) => r.search_cluster).filter(Boolean))) as string[],
    [rows]
  );

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== "all" && r.content_status !== status) return false;
    if (type !== "all" && r.intent_type !== type) return false;
    if (cluster !== "all" && r.search_cluster !== cluster) return false;
    if (pillarsOnly && !r.is_pillar) return false;
    if (q && !r.keyword.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).slice(0, 120), [rows, status, type, cluster, pillarsOnly, q]);

  const queue = useMemo(
    () => rows.filter((r) => r.content_status === "pending" || r.content_status === "queued").slice(0, 5),
    [rows]
  );

  const Chip = ({ active, onClick, children }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
        active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground"
      }`}
    >
      {children}
    </button>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Søkeintent-motor</CardTitle>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {Object.entries(counts).map(([k, v]) => (
              <span key={k} className={`px-2 py-0.5 rounded ${STATUS_COLOR[k] || "bg-muted"}`}>{k}: {v}</span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>Kvalitet: <b className="text-foreground">{metrics.avg_quality ?? 0}</b></span>
            <span>Etterspørsel: <b className="text-foreground">{metrics.avg_demand ?? 0}</b></span>
            <span>Kommersiell: <b className="text-foreground">{metrics.avg_commercial ?? 0}</b></span>
            <span>Prioritet: <b className="text-foreground">{metrics.avg_priority ?? 0}</b></span>
            <span>Klynger: <b className="text-foreground">{metrics.clusters_covered ?? 0}</b></span>
            <span>Pilarer: <b className="text-foreground">{metrics.pillars_published ?? 0}</b></span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>Embedding-dekning: <b className="text-foreground">{metrics.embed_coverage ?? 0}%</b></span>
            <span>Duplikater blokkert: <b className="text-foreground">{metrics.dupes_blocked ?? 0}</b></span>
            <span>Sammenslåinger: <b className="text-foreground">{metrics.merges ?? 0}</b></span>
            <span>Foreldreløse: <b className="text-foreground">{metrics.orphans ?? 0}</b></span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" />Oppdater
          </Button>
          <Button size="sm" variant="outline" onClick={() => call("embed", "embed-content", { batch: 20, passes: 3 })} disabled={busy === "embed"}>
            {busy === "embed" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Braces className="h-4 w-4 mr-1" />}
            Bygg embeddings
          </Button>
          <Button size="sm" variant="outline" onClick={() => call("compute", "compute-search-intents")} disabled={busy === "compute"}>
            {busy === "compute" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Target className="h-4 w-4 mr-1" />}
            Beregn backlog
          </Button>
          <Button size="sm" variant="outline" onClick={() => call("gen-batch", "generate-search-intent-page", { limit: 3 })} disabled={busy === "gen-batch"}>
            {busy === "gen-batch" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
            Generer top 3
          </Button>
          <Button size="sm" onClick={() => call("orch", "orchestrate-search-intents", { maxPillars: 2, maxSupporting: 3 })} disabled={busy === "orch"}>
            {busy === "orch" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Rocket className="h-4 w-4 mr-1" />}
            Full produksjon
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Produksjonskø */}
        {queue.length > 0 && (
          <div className="mb-6 border border-border p-3">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Neste i produksjonskø
            </div>
            <ol className="space-y-1 text-sm">
              {queue.map((r, i) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="tabular-nums text-muted-foreground w-4">{i + 1}.</span>
                  <span className="truncate flex-1">{r.keyword}</span>
                  {r.is_pillar && <Badge variant="outline" className="text-[10px]">pilar</Badge>}
                  <span className="tabular-nums text-xs text-muted-foreground">{Math.round(r.priority_score)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Filtre */}
        <div className="mb-4 space-y-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk i keywords…"
            className="max-w-sm"
            aria-label="Søk i keywords"
          />
          <div className="flex flex-wrap gap-1.5">
            <Chip active={status === "all"} onClick={() => setStatus("all")}>alle statuser</Chip>
            {STATUSES.map((s) => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={type === "all"} onClick={() => setType("all")}>alle intents</Chip>
            {TYPES.map((t) => (
              <Chip key={t} active={type === t} onClick={() => setType(t)}>{t}</Chip>
            ))}
            <Chip active={pillarsOnly} onClick={() => setPillarsOnly((v) => !v)}>kun pilarer</Chip>
          </div>
          {clusters.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip active={cluster === "all"} onClick={() => setCluster("all")}>alle klynger</Chip>
              {clusters.slice(0, 14).map((c) => (
                <Chip key={c} active={cluster === c} onClick={() => setCluster(c)}>{c}</Chip>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Laster…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">Ingen treff. Juster filtrene eller klikk «Beregn backlog».</div>
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="sm:hidden space-y-3">
              {filtered.map((r) => (
                <li key={r.id} className="border border-border rounded-md p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.content_status === "published" && r.target_slug ? (
                          <a href={`/intent/${r.target_slug}`} className="underline underline-offset-2" target="_blank" rel="noreferrer">{r.keyword}</a>
                        ) : r.keyword}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                        <span>{r.intent_type}</span>
                        {r.is_pillar && <Badge variant="outline" className="text-[10px]">pilar</Badge>}
                        <span className={`px-1.5 py-0.5 rounded ${STATUS_COLOR[r.content_status] || "bg-muted"}`}>{r.content_status}</span>
                      </div>
                      {r.duplicate_of && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Copy className="h-3 w-3" />{r.duplicate_of}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular-nums leading-none">{Math.round(r.priority_score)}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">prio</div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1 text-[11px] tabular-nums text-muted-foreground">
                    <span>D {Math.round(r.demand_score || 0)}</span>
                    <span>C {Math.round(r.commercial_score || 0)}</span>
                    <span>Cov {Math.round(r.coverage_score || 0)}</span>
                    <span>Q {Math.round(r.quality_score || 0)}</span>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button variant="outline" size="sm" className="min-h-11" disabled={busy === r.id}
                      onClick={() => call(r.id, "generate-search-intent-page", { ids: [r.id] })}>
                      {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Generer"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">Prio</th>
                    <th className="py-2 pr-3">Keyword</th>
                    <th className="py-2 pr-3">Klynge</th>
                    <th className="py-2 pr-3">Intent</th>
                    <th className="py-2 pr-3">D</th>
                    <th className="py-2 pr-3">C</th>
                    <th className="py-2 pr-3">Cov</th>
                    <th className="py-2 pr-3">Q</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 tabular-nums font-medium">{Math.round(r.priority_score)}</td>
                      <td className="py-2 pr-3">
                        {r.content_status === "published" && r.target_slug ? (
                          <a href={`/intent/${r.target_slug}`} className="underline underline-offset-2" target="_blank" rel="noreferrer">{r.keyword}</a>
                        ) : r.keyword}
                        {r.is_pillar && <Badge variant="outline" className="ml-2 text-[10px]">pilar</Badge>}
                        {r.duplicate_of && <span className="ml-2 text-[10px] text-muted-foreground">dup:{r.duplicate_of.slice(0, 24)}</span>}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{r.search_cluster || "—"}</td>
                      <td className="py-2 pr-3 text-xs">{r.intent_type}</td>
                      <td className="py-2 pr-3 tabular-nums text-xs">{Math.round(r.demand_score || 0)}</td>
                      <td className="py-2 pr-3 tabular-nums text-xs">{Math.round(r.commercial_score || 0)}</td>
                      <td className="py-2 pr-3 tabular-nums text-xs">{Math.round(r.coverage_score || 0)}</td>
                      <td className="py-2 pr-3 tabular-nums text-xs">{Math.round(r.quality_score || 0)}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${STATUS_COLOR[r.content_status] || "bg-muted"}`}>
                          {r.content_status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Button variant="ghost" size="sm" disabled={busy === r.id}
                          onClick={() => call(r.id, "generate-search-intent-page", { ids: [r.id] })}>
                          {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Generer"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SearchIntentPanel;
