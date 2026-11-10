import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";
import { getCategoryFallbackImage } from "@/utils/seo";
import {
  getReadingHistory,
  recentReadCategories,
  recentReadSlugs,
} from "@/lib/readingHistory";

interface Article {
  id: string;
  slug: string;
  title: string;
  category: string;
  image_url: string | null;
  meta_description: string | null;
  created_at: string;
}

interface Props {
  limit?: number;
  excludeId?: string;
}

// Personalised, no-auth recommendations.
// 1. If we have a last-read article id, fetch its semantic relations.
// 2. Otherwise fall back to most recent articles in categories the user reads.
// 3. Otherwise show latest published articles.
export const RecommendedForYou = ({ limit = 4, excludeId }: Props) => {
  const [items, setItems] = useState<Article[]>([]);
  const [hasHistory, setHasHistory] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const history = getReadingHistory();
      const seen = recentReadSlugs();
      const cats = recentReadCategories(3);
      const lastId = history.find((h) => !!h.id && h.id !== excludeId)?.id;
      setHasHistory(history.length > 0);

      let picked: Article[] = [];

      if (lastId) {
        const { data: rels } = await supabase
          .from("article_relations")
          .select("related_article_id, similarity_score")
          .eq("article_id", lastId)
          .order("similarity_score", { ascending: false })
          .limit(20);
        const relIds = (rels || []).map((r: any) => r.related_article_id).filter(Boolean);
        if (relIds.length) {
          const { data } = await supabase
            .from("articles")
            .select("id, slug, title, category, image_url, meta_description, created_at, published")
            .in("id", relIds)
            .eq("published", true);
          picked = (data || []).filter((a: any) => !seen.has(a.slug) && a.id !== excludeId);
        }
      }

      if (picked.length < limit && cats.length) {
        const { data } = await supabase
          .from("articles")
          .select("id, slug, title, category, image_url, meta_description, created_at, published")
          .in("category", cats)
          .eq("published", true)
          .order("created_at", { ascending: false })
          .limit(limit * 3);
        const extras = (data || []).filter(
          (a: any) => !seen.has(a.slug) && a.id !== excludeId && !picked.find((p) => p.id === a.id),
        );
        picked = [...picked, ...extras];
      }

      if (picked.length < limit) {
        const { data } = await supabase
          .from("articles")
          .select("id, slug, title, category, image_url, meta_description, created_at, published")
          .eq("published", true)
          .order("created_at", { ascending: false })
          .limit(limit * 3);
        const extras = (data || []).filter(
          (a: any) => !seen.has(a.slug) && a.id !== excludeId && !picked.find((p) => p.id === a.id),
        );
        picked = [...picked, ...extras];
      }

      if (!cancelled) setItems(picked.slice(0, limit));
    })();
    return () => {
      cancelled = true;
    };
  }, [limit, excludeId]);

  if (!items.length) return null;

  return (
    <section className="my-10">
      <div className="flex items-center justify-between mb-5 pb-3 border-b-2 border-foreground">
        <h2
          className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          <Sparkles className="h-4 w-4" />
          Anbefalt for deg
        </h2>
        <span
          className="text-[10px] uppercase tracking-wider text-muted-foreground"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {hasHistory ? "Basert på din lesning" : "Plukket av redaksjonen"}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map((a, i) => (
          <Link key={a.id} to={`/${a.slug}`} className="group block">
            <div className="overflow-hidden mb-2.5">
              <img
                src={a.image_url || getCategoryFallbackImage(a.category, i)}
                alt={a.title}
                loading="lazy"
                className="w-full aspect-[4/3] object-cover group-hover:scale-[1.02] transition-transform duration-500"
              />
            </div>
            <span
              className="text-[10px] font-bold uppercase tracking-widest text-destructive block mb-1"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {a.category}
            </span>
            <h3 className="font-serif text-base font-bold leading-tight group-hover:underline decoration-1 underline-offset-2 line-clamp-3">
              {a.title}
            </h3>
          </Link>
        ))}
      </div>
    </section>
  );
};
