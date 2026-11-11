import { Link } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { getCategoryFallbackImage } from "@/utils/seo";

interface Article {
  id: string;
  title: string;
  slug: string;
  category: string;
  image_url?: string | null;
  created_at: string;
  meta_description?: string | null;
  article_type?: string | null;
}

interface HeroSectionProps {
  articles: Article[];
}

export const HeroSection = ({ articles }: HeroSectionProps) => {
  if (articles.length === 0) return null;

  const mainArticle = articles[0];
  const secondaryArticles = articles.slice(1, 4);
  const imageUrl = mainArticle.image_url || getCategoryFallbackImage(mainArticle.category, 0);

  return (
    <section className="mb-12 md:mb-14" aria-label="Toppsaker">
      <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Main hero */}
        <div className="lg:col-span-8">
          <Link to={`/${mainArticle.slug}`} className="group block">
            <div className="relative overflow-hidden aspect-[16/10] lg:aspect-[16/9] bg-muted">
              <img
                src={imageUrl}
                alt={mainArticle.title}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
                <span
                  className="inline-block text-[11px] font-bold uppercase tracking-widest text-red-400 mb-2"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {mainArticle.category}
                </span>
                <h1 className="text-white mb-3 group-hover:underline decoration-2 underline-offset-4 text-balance">
                  {mainArticle.title}
                </h1>
                {mainArticle.meta_description && (
                  <p className="text-sm md:text-base text-white/80 leading-relaxed line-clamp-2 max-w-2xl">
                    {mainArticle.meta_description}
                  </p>
                )}
              </div>
            </div>
          </Link>
        </div>

        {/* Secondary */}
        <div className="lg:col-span-4 flex flex-col divide-y divide-border">
          {secondaryArticles.map((article, idx) => (
            <Link
              key={article.id}
              to={`/${article.slug}`}
              className="group flex gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex-shrink-0 w-24 sm:w-28 aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={article.image_url || getCategoryFallbackImage(article.category, idx + 1)}
                  alt={article.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-1"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {article.category}
                </span>
                <h2 className="text-sm md:text-base font-bold leading-snug text-foreground line-clamp-3 group-hover:underline decoration-1 underline-offset-2">
                  {article.title}
                </h2>
                <time
                  className="text-[11px] text-muted-foreground mt-1.5 block"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {format(new Date(article.created_at), "d. MMM yyyy", { locale: nb })}
                </time>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};
