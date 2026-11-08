import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Flame } from "lucide-react";

interface Article {
  id: string;
  slug: string;
  title: string;
  category: string;
  created_at: string;
  rel_count: number;
}

interface Props {
  limit?: number;
  windowHours?: number;
  title?: string;
  icon?: "flame" | "none";
}

// "Most read" proxy: in the last N hours, rank articles by how many semantic
// relations point to them (article_relations). High-relevance, no tracking DB.
export const MostReadToday = ({
  limit = 5,
  windowHours = 24,
  title = "Mest lest i dag",
  icon = "flame",
}: Props) => {
  const [items, setItems] = useState<Article[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("articles")
        .select("id, slug, title, category, created_at, published")
        .eq("published", true)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(80);
      const ids = (recent || []).map((a: any) => a.id);
      if (!ids.length) {
        if (!cancelled) setItems([]);
        return;
      }
      const { data: rels } = await supabase
        .from("article_relations")
        .select("article_id, related_article_id")
        .or(
          `article_id.in.(${ids.join(",")}),related_article_id.in.(${ids.join(",")})`,
        )
        .limit(2000);
      const counts = new Map<string, number>();
      (rels || []).forEach((r: any) => {
        if (ids.includes(r.article_id)) counts.set(r.article_id, (counts.get(r.article_id) || 0) + 1);
        if (ids.includes(r.related_article_id))
          counts.set(r.related_article_id, (counts.get(r.related_article_id) || 0) + 1);
      });
      const ranked = (recent || [])
        .map((a: any) => ({ ...a, rel_count: counts.get(a.id) || 0 }))
        .sort((a: any, b: any) => {
          if (b.rel_count !== a.rel_count) return b.rel_count - a.rel_count;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
        .slice(0, limit);
      if (!cancelled) setItems(ranked);
    })();
    return () => {
      cancelled = true;
    };
  }, [limit, windowHours]);

  if (!items.length) return null;

  return (
    <div>
      <h3
        className="text-xs font-bold uppercase tracking-widest mb-4 pb-3 border-b-2 border-foreground flex items-center gap-2"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {icon === "flame" && <Flame className="h-3.5 w-3.5" />}
        {title}
      </h3>
      <ol className="divide-y divide-border">
        {items.map((a, i) => (
          <li key={a.id}>
            <Link to={`/${a.slug}`} className="group flex gap-3 py-3.5 first:pt-0">
              <span
                className="text-xl font-bold text-muted-foreground/25 w-6 flex-shrink-0 leading-none tabular-nums"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="text-[13px] font-semibold line-clamp-2 group-hover:underline decoration-1 underline-offset-2 leading-snug">
                  {a.title}
                </h4>
                <span
                  className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 block"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {a.category}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
};
