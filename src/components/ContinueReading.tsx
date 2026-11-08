import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight } from "lucide-react";
import { getCategoryFallbackImage } from "@/utils/seo";

interface Props {
  articleId: string;
  category: string;
}

interface Article {
  id: string;
  slug: string;
  title: string;
  category: string;
  image_url: string | null;
  meta_description: string | null;
  created_at: string;
}

// End-of-article semantic next-read banner.
// Prefers a semantically related article, falls back to latest in category.
export const ContinueReading = ({ articleId, category }: Props) => {
  const [next, setNext] = useState<Article | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rels } = await supabase
        .from("article_relations")
        .select("related_article_id, similarity_score")
        .eq("article_id", articleId)
        .order("similarity_score", { ascending: false })
        .limit(5);
      const ids = (rels || []).map((r) => r.related_article_id);
      if (ids.length) {
        const { data: arts } = await supabase
          .from("articles")
          .select("id, slug, title, category, image_url, meta_description, created_at, published")
          .in("id", ids)
          .eq("published", true)
          .limit(5);
        const ordered = ids
          .map((id) => (arts || []).find((a) => a.id === id))
          .filter(Boolean) as Article[];
        if (ordered[0]) { if (!cancelled) setNext(ordered[0]); return; }
      }
      // Fallback: latest in same category
      const { data: latest } = await supabase
        .from("articles")
        .select("id, slug, title, category, image_url, meta_description, created_at")
        .eq("published", true)
        .eq("category", category)
        .neq("id", articleId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && latest) setNext(latest as Article);
    })();
    return () => { cancelled = true; };
  }, [articleId, category]);

  if (!next) return null;

  return (
    <Link
      to={`/${next.slug}`}
      className="group block my-10 border-t-2 border-b-2 border-foreground py-6"
    >
      <div
        className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-3 flex items-center gap-2"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        Fortsett å lese
        <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
      </div>
      <div className="grid md:grid-cols-12 gap-5 items-center">
        <div className="md:col-span-4">
          <img
            src={next.image_url || getCategoryFallbackImage(next.category, 0)}
            alt={next.title}
            className="w-full aspect-[16/10] object-cover"
            loading="lazy"
          />
        </div>
        <div className="md:col-span-8">
          <span
            className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-1.5 block"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {next.category}
          </span>
          <h3 className="font-serif text-2xl md:text-3xl font-bold leading-tight group-hover:underline decoration-1 underline-offset-4">
            {next.title}
          </h3>
          {next.meta_description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
              {next.meta_description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
};
