import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { relativeTimeNo } from "@/lib/freshness";

interface Article {
  id: string;
  slug: string;
  title: string;
  category: string;
  created_at: string;
  image_url: string | null;
}

interface Props {
  entityId: string;
  pageSize?: number;
}

export const EntityTimeline = ({ entityId, pageSize = 20 }: Props) => {
  const [items, setItems] = useState<Article[]>([]);
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setItems([]);
    setPage(0);
    setDone(false);
  }, [entityId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data } = await supabase
        .from("article_entities")
        .select("article_id, articles!inner(id, slug, title, category, created_at, image_url, published)")
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (cancelled) return;
      const arts = (data || [])
        .map((r) => r.articles)
        .filter((a) => a && a.published);
      setItems((prev) => [...prev, ...arts]);
      if (arts.length < pageSize) setDone(true);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entityId, page, pageSize]);

  // Group by day
  const groups: Record<string, Article[]> = {};
  items.forEach((a) => {
    const day = new Date(a.created_at).toLocaleDateString("nb-NO", {
      weekday: "long", day: "numeric", month: "long",
    });
    (groups[day] ||= []).push(a);
  });

  return (
    <div>
      {Object.entries(groups).map(([day, arts]) => (
        <section key={day} className="mb-8">
          <h3
            className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 pb-2 border-b border-border"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {day}
          </h3>
          <ul className="divide-y divide-border">
            {arts.map((a) => (
              <li key={a.id} className="py-3 flex gap-4 items-start">
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/${a.slug}`}
                    className="block text-[15px] font-semibold leading-snug hover:underline"
                    style={{ fontFamily: "'Source Serif 4', serif" }}
                  >
                    {a.title}
                  </Link>
                  <div
                    className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    {a.category} · {relativeTimeNo(a.created_at)}
                  </div>
                </div>
                {a.image_url && (
                  <img src={a.image_url} alt="" className="w-20 h-20 object-cover shrink-0" loading="lazy" />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!done && (
        <button
          disabled={loading}
          onClick={() => setPage((p) => p + 1)}
          className="mt-4 w-full py-3 border border-foreground text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {loading ? "Laster…" : "Last flere artikler"}
        </button>
      )}
      {done && !items.length && (
        <p className="text-sm text-muted-foreground py-8 text-center">Ingen artikler funnet ennå.</p>
      )}
    </div>
  );
};
