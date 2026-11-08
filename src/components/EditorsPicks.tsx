import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Award } from "lucide-react";
import { getCategoryFallbackImage } from "@/utils/seo";

interface PickedArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  image_url: string | null;
  meta_description: string | null;
  created_at: string;
  rel_count: number;
}

interface Props {
  limit?: number;
}

// "Editor's Picks" = most semantically central articles (most related links).
// Stable, no extra writes. Cached per session for performance.
export const EditorsPicks = ({ limit = 4 }: Props) => {
  const [articles, setArticles] = useState<PickedArticle[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
      // Count relations per article in the last 21 days
      const { data: rels } = await supabase
        .from("article_relations")
        .select("article_id, related_article_id")
        .gte("created_at", since)
        .limit(2000);
      const counts = new Map<string, number>();
      (rels || []).forEach((r: any) => {
        counts.set(r.article_id, (counts.get(r.article_id) || 0) + 1);
      });
      const topIds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit * 3)
        .map(([id]) => id);
      if (!topIds.length) { setArticles([]); return; }
      const { data: arts } = await supabase
        .from("articles")
        .select("id, slug, title, category, image_url, meta_description, created_at, published")
        .in("id", topIds)
        .eq("published", true);
      if (cancelled) return;
      const ordered = (arts || [])
        .map((a: any) => ({ ...a, rel_count: counts.get(a.id) || 0 }))
        .sort((a, b) => b.rel_count - a.rel_count)
        .slice(0, limit);
      setArticles(ordered);
    })();
    return () => { cancelled = true; };
  }, [limit]);

  if (!articles.length) return null;

  return (
    <section className="my-12">
      <div className="flex items-center justify-between mb-5 pb-3 border-b-2 border-foreground">
        <h2
          className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          <Award className="h-4 w-4" />
          Redaktørens valg
        </h2>
        <span
          className="text-[10px] uppercase tracking-wider text-muted-foreground"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Mest sentrale saker
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
        {articles.map((a, i) => (
          <Link key={a.id} to={`/${a.slug}`} className="group block">
            <div className="overflow-hidden mb-3">
              <img
                src={a.image_url || getCategoryFallbackImage(a.category, i)}
                alt={a.title}
                className="w-full aspect-[16/9] object-cover group-hover:scale-[1.02] transition-transform duration-500"
                loading="lazy"
              />
            </div>
            <span
              className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-1.5 block"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {a.category}
            </span>
            <h3 className="font-serif text-xl md:text-2xl font-bold leading-tight group-hover:underline decoration-1 underline-offset-4 line-clamp-3">
              {a.title}
            </h3>
            {a.meta_description && (
              <p className="text-[13px] text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                {a.meta_description}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
};
