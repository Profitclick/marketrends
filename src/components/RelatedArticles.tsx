import { Link } from "react-router-dom";
import { getCategoryFallbackImage } from "@/utils/seo";

interface Article {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  meta_description: string | null;
  image_url: string | null;
  created_at: string;
}

interface RelatedArticlesProps {
  currentArticle: {
    id: string;
    category: string;
    tags: string[];
  };
  allArticles: Article[];
  variant?: "sidebar" | "inline" | "footer";
}

export const RelatedArticles = ({ currentArticle, allArticles, variant = "sidebar" }: RelatedArticlesProps) => {
  const getRelevanceScore = (article: Article): number => {
    if (article.id === currentArticle.id) return -1;
    let score = 0;
    if (article.category === currentArticle.category) score += 3;
    const matchingTags = article.tags?.filter((tag) => currentArticle.tags?.includes(tag)) || [];
    score += matchingTags.length;
    return score;
  };

  const relatedArticles = allArticles
    .map((article) => ({ ...article, relevanceScore: getRelevanceScore(article) }))
    .filter((article) => article.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, variant === "footer" ? 4 : variant === "inline" ? 1 : 5);

  if (relatedArticles.length === 0) return null;

  if (variant === "inline") {
    const article = relatedArticles[0];
    return (
      <aside className="my-8 py-4 border-t border-b border-border">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
          Les også
        </span>
        <Link to={`/${article.slug}`} className="block mt-2 group">
          <h4 className="text-base font-semibold leading-snug group-hover:underline decoration-1 underline-offset-2">
            {article.title}
          </h4>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1 block" style={{ fontFamily: "'Inter', sans-serif" }}>
            {article.category}
          </span>
        </Link>
      </aside>
    );
  }

  if (variant === "footer") {
    return (
      <section className="mt-14 pt-8 border-t border-border">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground mb-6 pb-3 border-b-2 border-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
          Relaterte artikler
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          {relatedArticles.map((article, index) => {
            const imageUrl = article.image_url || getCategoryFallbackImage(article.category, index);
            return (
              <Link key={article.id} to={`/${article.slug}`} className="group flex gap-4 pb-5 border-b border-border last:border-b-0">
                {imageUrl && (
                  <div className="w-24 h-18 flex-shrink-0 overflow-hidden">
                    <img src={imageUrl} alt={article.title} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-destructive" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {article.category}
                  </span>
                  <h4 className="text-sm font-bold line-clamp-2 group-hover:underline decoration-1 underline-offset-2 mt-0.5">
                    {article.title}
                  </h4>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground mb-4 pb-3 border-b-2 border-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
        Relaterte artikler
      </h3>
      <div className="divide-y divide-border">
        {relatedArticles.map((article) => (
          <Link key={article.id} to={`/${article.slug}`} className="block group py-3.5 first:pt-0">
            <h4 className="text-[13px] font-semibold line-clamp-2 group-hover:underline decoration-1 underline-offset-2 leading-snug">
              {article.title}
            </h4>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1 block" style={{ fontFamily: "'Inter', sans-serif" }}>
              {article.category}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};
