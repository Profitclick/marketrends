import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

interface Row {
  id: string;
  name: string;
  slug: string;
  authority_score: number | null;
  trending_score: number | null;
  article_count: number | null;
  articles_last_7d: number | null;
}

const heat = (n: number) => {
  if (n >= 70) return "bg-emerald-100";
  if (n >= 50) return "bg-emerald-50";
  if (n >= 30) return "bg-amber-50";
  return "bg-muted";
};

type SortKey = "authority" | "opportunity" | "articles" | "momentum";

export const TopicHeatmap = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, { g: number; k: number; c: number; opp: number }>>({});
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("authority");

  useEffect(() => {
    (async () => {
      const sb = supabase as any;
      const { data } = await sb.from("topics")
        .select("id, name, slug, authority_score, trending_score, article_count, articles_last_7d")
        .order("authority_score", { ascending: false }).limit(200);
      setRows(data || []);

      // Aggregate guide/knowledge/comparison/opportunity counts by topic name (approximate via category fallback if no topic link)
      const ids = (data || []).map((r) => r.id);
      if (!ids.length) return;
      const [g, k, c, o] = await Promise.all([
        sb.from("guides").select("topic_id"),
        sb.from("knowledge_pages").select("topic_id"),
        sb.from("comparison_pages").select("topic_id"),
        sb.from("opportunities").select("topic_id, opportunity_score"),
      ]);
      const map: Record<string, { g: number; k: number; c: number; opp: number }> = {};
      for (const id of ids) map[id] = { g: 0, k: 0, c: 0, opp: 0 };
      (g.data || []).forEach((r) => r.topic_id && map[r.topic_id] && map[r.topic_id].g++);
      (k.data || []).forEach((r) => r.topic_id && map[r.topic_id] && map[r.topic_id].k++);
      (c.data || []).forEach((r) => r.topic_id && map[r.topic_id] && map[r.topic_id].c++);
      (o.data || []).forEach((r) => {
        if (!r.topic_id || !map[r.topic_id]) return;
        map[r.topic_id].opp = Math.max(map[r.topic_id].opp, r.opportunity_score || 0);
      });
      setCounts(map);
    })();
  }, []);

  const visible = useMemo(() => {
    const filtered = rows.filter((r) => r.name?.toLowerCase().includes(q.toLowerCase()));
    return [...filtered].sort((a, b) => {
      const ca = counts[a.id] || { g: 0, k: 0, c: 0, opp: 0 };
      const cb = counts[b.id] || { g: 0, k: 0, c: 0, opp: 0 };
      if (sort === "authority") return (b.authority_score || 0) - (a.authority_score || 0);
      if (sort === "opportunity") return cb.opp - ca.opp;
      if (sort === "articles") return (b.article_count || 0) - (a.article_count || 0);
      return (b.articles_last_7d || 0) - (a.articles_last_7d || 0);
    });
  }, [rows, counts, q, sort]);

  const Header = ({ id, label }: { id: SortKey; label: string }) => (
    <button onClick={() => setSort(id)} className={`text-left ${sort === id ? "font-semibold" : ""}`}>{label}</button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Topic Heatmap</h2>
        <Input placeholder="Søk tema..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      {/* Mobile: cards */}
      <ul className="sm:hidden space-y-2">
        {visible.map((r) => {
          const c = counts[r.id] || { g: 0, k: 0, c: 0, opp: 0 };
          const gap = ((c.g === 0 ? 30 : 0) + (c.k === 0 ? 30 : 0) + (c.c === 0 ? 20 : 0) + ((r.article_count || 0) < 3 ? 20 : 0));
          return (
            <li key={r.id} className="border border-border rounded-md p-3">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/topic/${r.slug}`} className="font-medium hover:underline min-w-0 truncate">{r.name}</Link>
                <span className={`text-xs px-2 py-0.5 rounded ${heat(r.authority_score || 0)}`}>Aut {Math.round(r.authority_score || 0)}</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1 text-[11px] text-muted-foreground tabular-nums">
                <span>Mul {Math.round(c.opp)}</span>
                <span>Art {r.article_count || 0}</span>
                <span>Mom {r.articles_last_7d || 0}</span>
                <span className={gap >= 60 ? "text-amber-700 font-medium" : ""}>Gap {gap}</span>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] text-muted-foreground tabular-nums">
                <span>Guider {c.g}</span>
                <span>Knowl {c.k}</span>
                <span>Sml {c.c}</span>
              </div>
            </li>
          );
        })}
        {visible.length === 0 && <li className="p-4 text-center text-muted-foreground text-sm">Ingen tema.</li>}
      </ul>
      {/* Desktop: table */}
      <div className="hidden sm:block border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left p-2">Topic</th>
              <th className="text-left p-2"><Header id="authority" label="Autoritet" /></th>
              <th className="text-left p-2"><Header id="opportunity" label="Mulighet" /></th>
              <th className="text-right p-2"><Header id="articles" label="Artikler" /></th>
              <th className="text-right p-2">Guider</th>
              <th className="text-right p-2">Knowledge</th>
              <th className="text-right p-2">Sammenl.</th>
              <th className="text-right p-2"><Header id="momentum" label="Momentum" /></th>
              <th className="text-right p-2">Dekningsgap</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const c = counts[r.id] || { g: 0, k: 0, c: 0, opp: 0 };
              const gap = ((c.g === 0 ? 30 : 0) + (c.k === 0 ? 30 : 0) + (c.c === 0 ? 20 : 0) + ((r.article_count || 0) < 3 ? 20 : 0));
              return (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-2"><Link to={`/topic/${r.slug}`} className="hover:underline">{r.name}</Link></td>
                  <td className={`p-2 ${heat(r.authority_score || 0)}`}>{Math.round(r.authority_score || 0)}</td>
                  <td className={`p-2 ${heat(c.opp)}`}>{Math.round(c.opp)}</td>
                  <td className="p-2 text-right">{r.article_count || 0}</td>
                  <td className="p-2 text-right">{c.g}</td>
                  <td className="p-2 text-right">{c.k}</td>
                  <td className="p-2 text-right">{c.c}</td>
                  <td className="p-2 text-right">{r.articles_last_7d || 0}</td>
                  <td className={`p-2 text-right ${gap >= 60 ? "bg-amber-50" : ""}`}>{gap}</td>
                </tr>
              );
            })}
            {visible.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Ingen tema.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
