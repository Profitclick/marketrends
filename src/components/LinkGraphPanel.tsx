import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export const LinkGraphPanel = () => {
  const [stats, setStats] = useState<{ total: number; topTargets: any[]; orphans: any[] }>({
    total: 0, topTargets: [], orphans: [],
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const sb = supabase as any;
    const { count } = await sb.from("internal_links").select("*", { count: "exact", head: true });
    const { data: links } = await sb.from("internal_links")
      .select("target_type, target_slug, anchor")
      .limit(2000);
    const tally = new Map<string, { type: string; slug: string; anchor: string; count: number }>();
    for (const l of links || []) {
      const key = `${l.target_type}:${l.target_slug}`;
      const prev = tally.get(key);
      tally.set(key, { type: l.target_type, slug: l.target_slug, anchor: l.anchor, count: (prev?.count || 0) + 1 });
    }
    const topTargets = Array.from(tally.values()).sort((a, b) => b.count - a.count).slice(0, 20);

    const { data: articles } = await sb.from("articles").select("slug, title").eq("published", true).limit(500);
    const linkedSlugs = new Set((links || []).filter((l: any) => l.target_type === "article").map((l: any) => l.target_slug));
    const orphans = (articles || []).filter((a: any) => !linkedSlugs.has(a.slug)).slice(0, 20);

    setStats({ total: count || 0, topTargets, orphans });
  };

  useEffect(() => { load(); }, []);

  const build = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("build-internal-links");
    setBusy(false);
    if (error) toast({ title: "Feil", description: error.message, variant: "destructive" });
    else { toast({ title: "Lenker bygget" }); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-serif text-2xl">Lenkegraf</h2>
          <p className="text-sm text-muted-foreground">Totalt {stats.total} interne lenker</p>
        </div>
        <Button onClick={build} disabled={busy}>{busy ? "Bygger…" : "Bygg lenker"}</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-medium mb-2">Topp 20 mest lenkede</h3>
          <ul className="text-sm space-y-1">
            {stats.topTargets.map((t) => (
              <li key={`${t.type}:${t.slug}`} className="flex justify-between border-b border-border/60 py-1">
                <span><span className="text-muted-foreground text-xs uppercase mr-2">{t.type}</span>{t.anchor || t.slug}</span>
                <span className="font-mono">{t.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-medium mb-2">Foreldreløse artikler (ingen innlenker)</h3>
          <ul className="text-sm space-y-1">
            {stats.orphans.map((o) => (
              <li key={o.slug} className="border-b border-border/60 py-1">{o.title}</li>
            ))}
            {stats.orphans.length === 0 && <li className="text-muted-foreground">Ingen.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LinkGraphPanel;
