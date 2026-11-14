import { Link } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { getCategoryFallbackImage } from "@/utils/seo";
import { ArticleImage } from "@/components/ArticleImage";

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

interface ArticleCardProps {
  article: Article;
  index?: number;
  showImage?: boolean;
  showIngress?: boolean;
  size?: "large" | "medium" | "small";
  imageUrl?: string;
  fallbackImageUrl?: string;
}

export const ArticleCard = ({
  article,
  index = 0,
  showImage = true,
  showIngress = true,
  size = "medium",
  imageUrl,
  fallbackImageUrl,
}: ArticleCardProps) => {
  const resolvedImageUrl = imageUrl || article.image_url || getCategoryFallbackImage(article.category, index);
  const resolvedFallbackUrl = fallbackImageUrl || getCategoryFallbackImage(article.category, index + 1);

  return (
    <Link to={`/${article.slug}`} className="group block h-full border-b border-border pb-6">
      {showImage && (
        <div className="overflow-hidden mb-4 bg-muted">
          <ArticleImage
            src={resolvedImageUrl}
            fallbackSrc={resolvedFallbackUrl}
            alt={article.title}
            className={`w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] ${
              size === "large" ? "aspect-[16/10]" : "aspect-[16/9]"
            }`}
            loading="lazy"
            decoding="async"
            sizes={size === "large" ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"}
          />
        </div>
      )}
      <span className="text-[10px] font-bold font-sans uppercase tracking-[0.14em] text-destructive mb-2 block">
        {article.category}
      </span>
      <h3
        className={`font-bold leading-snug group-hover:underline decoration-1 underline-offset-4 mb-2 ${
          size === "large"
            ? "text-xl md:text-2xl line-clamp-3 tracking-[-0.01em]"
            : size === "medium"
            ? "text-lg md:text-xl line-clamp-3"
            : "text-sm md:text-base line-clamp-2 tracking-[-0.005em]"
        }`}
      >
        {article.title}
      </h3>
      {showIngress && article.meta_description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-6">
          {article.meta_description}
        </p>
      )}
      <time dateTime={article.created_at} className="text-[11px] font-sans text-muted-foreground block">
        {format(new Date(article.created_at), "d. MMM yyyy", { locale: nb })}
      </time>
    </Link>
  );
};
