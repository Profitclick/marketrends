import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Compass, Zap, TrendingUp, AlertTriangle, RefreshCw, Play, X } from "lucide-react";

interface Opportunity {
  id: string;
  keyword: string | null;
  category: string | null;
  source: string | null;
  recommended_content_type: string | null;
  opportunity_score: number;
  search_demand_score: number;
  commercial_score: number;
  competition_score: number;
  momentum_score: number;
  coverage_score: number;
  status: string;
}

const scoreColor = (n: number) =>
  n >= 70 ? "bg-emerald-100 text-emerald-800"
  : n >= 50 ? "bg-amber-100 text-amber-800"
  : "bg-muted text-muted-foreground";

export const OpportunityCenter = () => {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [orchestrating, setOrchestrating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("opportunities")
      .select("*")
      .order("opportunity_score", { ascending: false })
      .limit(100);
    setItems((data as Opportunity[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const compute = async () => {
    setComputing(true);
    toast.info("Beregner muligheter...");
    const { data, error } = await supabase.functions.invoke("compute-opportunities");
    setComputing(false);
    if (error) return toast.error(error.message);
    toast.success(`Beregnet ${(data as any)?.opportunities ?? 0} muligheter`);
    load();
  };

  const orchestrate = async () => {
    setOrchestrating(true);
    toast.info("Setter i gang innholdsgenerering...");
    const { data, error } = await supabase.functions.invoke("orchestrate-content");
    setOrchestrating(false);
    if (error) return toast.error(error.message);
    toast.success(`Sendt ${(data as any)?.dispatched?.length ?? 0} jobber`);
    load();
  };

  const dismiss = async (id: string) => {
    await supabase.from("opportunities").update({ status: "dismissed" }).eq("id", id);
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const top = items.slice(0, 12);
  const risingTopics = items.filter((i) => i.source === "topics").slice(0, 8);
  const risingEntities = items.filter((i) => i.source === "entities").slice(0, 8);
  const highCommercial = [...items].sort((a, b) => b.commercial_score - a.commercial_score).slice(0, 8);
  const lowCompetition = [...items].sort((a, b) => a.competition_score - b.competition_score).slice(0, 8);
  const gaps = [...items].filter((i) => i.coverage_score < 30).slice(0, 8);

  const renderRow = (o: Opportunity) => (
    <div key={o.id} className="flex items-center justify-between gap-2 py-2 border-b border-border/60 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{o.keyword || "—"}</div>
        <div className="flex flex-wrap gap-1.5 mt-1 text-[11px] text-muted-foreground">
          {o.category && <span>{o.category}</span>}
          {o.recommended_content_type && <span>· {o.recommended_content_type}</span>}
        </div>
      </div>
      <Badge className={scoreColor(o.opportunity_score)} variant="secondary">
        {Math.round(o.opportunity_score)}
      </Badge>
      <Button size="sm" variant="ghost" onClick={() => dismiss(o.id)} title="Avvis">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Compass className="h-5 w-5" /> Opportunity Center
          </h2>
          <p className="text-sm text-muted-foreground">
            Datadrevne innholdsmuligheter på tvers av tema, entiteter og kategorier.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Oppdater
          </Button>
          <Button size="sm" onClick={compute} disabled={computing}>
            <Zap className="h-4 w-4 mr-1" /> Beregn
          </Button>
          <Button size="sm" variant="outline" onClick={async () => {
            toast.info("Beregner autoritet...");
            const { error } = await supabase.functions.invoke("compute-authority");
            if (error) toast.error(error.message); else toast.success("Autoritet oppdatert");
          }}>
            <Compass className="h-4 w-4 mr-1" /> Autoritet
          </Button>
          <Button size="sm" variant="outline" onClick={async () => {
            toast.info("Bygger interne lenker...");
            const { error } = await supabase.functions.invoke("build-internal-links");
            if (error) toast.error(error.message); else toast.success("Lenkegraf oppdatert");
          }}>
            <Compass className="h-4 w-4 mr-1" /> Lenker
          </Button>
          <Button size="sm" variant="default" onClick={orchestrate} disabled={orchestrating}>
            <Play className="h-4 w-4 mr-1" /> Orkestrér
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Topp muligheter</CardTitle></CardHeader>
          <CardContent>
            {top.length === 0 ? <p className="text-sm text-muted-foreground">Ingen data – kjør "Beregn" for å starte.</p> : top.map(renderRow)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Dekningsgap</CardTitle></CardHeader>
          <CardContent>{gaps.length === 0 ? <p className="text-sm text-muted-foreground">Ingen gap funnet.</p> : gaps.map(renderRow)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Raskest stigende tema</CardTitle></CardHeader>
          <CardContent>{risingTopics.map(renderRow)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Raskest stigende entiteter</CardTitle></CardHeader>
          <CardContent>{risingEntities.map(renderRow)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Høy kommersiell intensjon</CardTitle></CardHeader>
          <CardContent>{highCommercial.map(renderRow)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Lav konkurranse</CardTitle></CardHeader>
          <CardContent>{lowCompetition.map(renderRow)}</CardContent>
        </Card>
      </div>
    </div>
  );
};
