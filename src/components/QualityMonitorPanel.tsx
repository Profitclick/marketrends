import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

type Row = { id: string; title: string; slug: string; score: number; breakdown: any; updated_at: string };

/**
 * Phase 4 quality monitor.
 * Read-only dashboard panel: authority scoring, orphan articles, feed health,
 * schema-completeness sample. No writes.
 */
export const QualityMonitorPanel = () => {
  const [tab, setTab] = useState<"authority" | "orphans" | "feeds" | "schema">("authority");
  const [rows, setRows] = useState<Row[]>([]);
  const [orphans, setOrphans] = useState<any[]>([]);
  const [feeds, setFeeds] = useState<any[]>([]);
  const [schema, setSchema] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabase as any;
    (async () => {
      const { data } = await sb.from("articles")
        .select("id,title,slug,editorial_authority_score,authority_breakdown,updated_at")
        .eq("published", true)
        .order("editorial_authority_score", { ascending: true })
        .limit(50);
      setRows((data || []).map((d: any) => ({
        ...d, score: d.editorial_authority_score, breakdown: d.authority_breakdown,
      })));

      const { data: arts } = await sb.from("articles")
        .select("id,title,slug,updated_at").eq("published", true).limit(500)
        .order("updated_at", { ascending: false });
      const { data: links } = await sb.from("internal_links")
        .select("target_slug").eq("target_type", "article");
      const linked = new Set((links || []).map((l: any) => l.target_slug));
      setOrphans((arts || []).filter((a: any) => !linked.has(a.slug)).slice(0, 25));

      const { data: fd } = await sb.from("rss_feeds")
        .select("id,name,url,active,last_fetched_at").order("last_fetched_at", { ascending: true, nullsFirst: true });
      setFeeds(fd || []);

      const { data: sample } = await sb.from("articles")
        .select("slug,title,ingress,key_takeaways,faq,sources")
        .eq("published", true).order("published_at", { ascending: false }).limit(20);
      setSchema((sample || []).map((a: any) => ({
        slug: a.slug, title: a.title,
        hasIngress: !!(a.ingress && a.ingress.length > 60),
        hasKT: Array.isArray(a.key_takeaways) && a.key_takeaways.length >= 3,
        hasFaq: Array.isArray(a.faq) && a.faq.length >= 2,
        hasSources: Array.isArray(a.sources) && a.sources.length >= 2,
      })));
    })();
  }, []);

  const runScoring = async () => {
    setRunning(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke("compute-editorial-authority", { body: {} });
    setRunning(false);
    setMsg(error ? `Feil: ${error.message}` : `Poengsatt ${data?.scored || 0} artikler`);
  };

  const tabs: Array<[typeof tab, string]> = [
    ["authority", "Autoritet"], ["orphans", "Foreldreløse"],
    ["feeds", "RSS-helse"], ["schema", "Schema-dekning"],
  ];

  return (
    <section className="border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex gap-1">
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-1.5 text-sm ${tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {label}
            </button>
          ))}
        </div>
        {tab === "authority" && (
          <button onClick={runScoring} disabled={running}
            className="text-xs border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-50">
            {running ? "Beregner…" : "Kjør autoritetsberegning"}
          </button>
        )}
      </div>
      {msg && <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">{msg}</div>}

      <div className="p-4">
        {tab === "authority" && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Artikkel</th><th>Score</th><th>Kilder</th><th>Lenker</th><th>Ferskhet</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 pr-3"><Link to={`/${r.slug}`} className="hover:underline">{r.title}</Link></td>
                  <td className="font-medium">{Math.round(r.score || 0)}</td>
                  <td className="text-muted-foreground">{r.breakdown?.sources ?? "–"}</td>
                  <td className="text-muted-foreground">{r.breakdown?.links ?? "–"}</td>
                  <td className="text-muted-foreground">{r.breakdown?.freshness ?? "–"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Ingen data. Kjør beregning.</td></tr>}
            </tbody>
          </table>
        )}

        {tab === "orphans" && (
          <ul className="space-y-2 text-sm">
            {orphans.map((o) => (
              <li key={o.id} className="flex items-center justify-between border-b border-border pb-2">
                <Link to={`/${o.slug}`} className="hover:underline">{o.title}</Link>
                <span className="text-xs text-muted-foreground">{new Date(o.updated_at).toLocaleDateString("nb-NO")}</span>
              </li>
            ))}
            {orphans.length === 0 && <li className="text-muted-foreground">Ingen foreldreløse artikler.</li>}
          </ul>
        )}

        {tab === "feeds" && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Kilde</th><th>Aktiv</th><th>Sist hentet</th></tr>
            </thead>
            <tbody>
              {feeds.map((f) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="py-2 pr-3">{f.name}</td>
                  <td>{f.active ? "Ja" : "Nei"}</td>
                  <td className="text-muted-foreground">{f.last_fetched_at ? new Date(f.last_fetched_at).toLocaleString("nb-NO") : "Aldri"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "schema" && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Artikkel</th><th>Ingress</th><th>KT</th><th>FAQ</th><th>Kilder</th></tr>
            </thead>
            <tbody>
              {schema.map((s) => (
                <tr key={s.slug} className="border-t border-border">
                  <td className="py-2 pr-3"><Link to={`/${s.slug}`} className="hover:underline">{s.title}</Link></td>
                  {["hasIngress", "hasKT", "hasFaq", "hasSources"].map((k) => (
                    <td key={k}>{s[k] ? "✓" : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default QualityMonitorPanel;
