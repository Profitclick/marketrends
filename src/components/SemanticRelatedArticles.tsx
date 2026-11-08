import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryFallbackImage } from "@/utils/seo";

interface RelatedArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  image_url: string | null;
  created_at: string;
  similarity_score: number;
}

interface Props {
  articleId: string;
  variant?: "footer" | "sidebar";
  limit?: number;
}

export const SemanticRelatedArticles = ({ articleId, variant = "footer", limit = 6 }: Props) => {
  const [items, setItems] = useState<RelatedArticle[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("article_relations")
        .select("similarity_score, articles!article_relations_related_article_id_fkey!inner(id, slug, title, category, image_url, created_at, published)")
        .eq("article_id", articleId)
        .order("similarity_score", { ascending: false })
        .limit(limit);
      if (cancelled) return;
      const list = (data || [])
        .map((r) => r.articles ? { ...r.articles, similarity_score: r.similarity_score } : null)
        .filter((x) => x && x.published);
      setItems(list);
    })();
    return () => { cancelled = true; };
  }, [articleId, limit]);

  if (!items.length) return null;

  if (variant === "sidebar") {
    return (
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground mb-4 pb-3 border-b-2 border-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
          Relatert lesing
        </h3>
        <div className="divide-y divide-border">
          {items.slice(0, 5).map((a) => (
            <Link key={a.id} to={`/${a.slug}`} className="block group py-3.5 first:pt-0">
              <h4 className="text-[13px] font-semibold line-clamp-2 group-hover:underline decoration-1 underline-offset-2 leading-snug">
                {a.title}
              </h4>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1 block" style={{ fontFamily: "'Inter', sans-serif" }}>
                {a.category}
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="mt-14 pt-8 border-t border-border">
      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground mb-6 pb-3 border-b-2 border-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
        Relaterte artikler
      </h3>
      <div className="grid md:grid-cols-2 gap-6">
        {items.map((a, i) => {
          const img = a.image_url || getCategoryFallbackImage(a.category, i);
          return (
            <Link key={a.id} to={`/${a.slug}`} className="group flex gap-4 pb-5 border-b border-border last:border-b-0">
              <div className="w-24 h-18 flex-shrink-0 overflow-hidden">
                <img src={img} alt={a.title} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-destructive" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {a.category}
                </span>
                <h4 className="text-sm font-bold line-clamp-2 group-hover:underline decoration-1 underline-offset-2 mt-0.5">
                  {a.title}
                </h4>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
