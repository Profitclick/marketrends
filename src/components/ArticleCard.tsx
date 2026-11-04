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

interface ArticleCardProps {
  article: Article;
  index?: number;
  showImage?: boolean;
  showIngress?: boolean;
  size?: "large" | "medium" | "small";
}

export const ArticleCard = ({
  article,
  index = 0,
  showImage = true,
  showIngress = true,
  size = "medium",
}: ArticleCardProps) => {
  const imageUrl = article.image_url || getCategoryFallbackImage(article.category, index);

  return (
    <Link to={`/${article.slug}`} className="group block">
      {showImage && (
        <div className="overflow-hidden mb-3">
          <img
            src={imageUrl}
            alt={article.title}
            className={`w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] ${
              size === "large" ? "aspect-[16/10]" : "aspect-[16/9]"
            }`}
            loading="lazy"
          />
        </div>
      )}
      <span
        className="text-[11px] font-bold uppercase tracking-widest text-destructive mb-1.5 block"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {article.category}
      </span>
      <h3
        className={`font-bold leading-snug group-hover:underline decoration-1 underline-offset-2 mb-1.5 ${
          size === "large"
            ? "text-xl md:text-2xl line-clamp-3"
            : size === "medium"
            ? "text-base md:text-lg line-clamp-3"
            : "text-sm md:text-base line-clamp-2"
        }`}
      >
        {article.title}
      </h3>
      {showIngress && article.meta_description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-1.5 leading-relaxed">
          {article.meta_description}
        </p>
      )}
      <time
        className="text-[11px] text-muted-foreground block"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {format(new Date(article.created_at), "d. MMM yyyy", { locale: nb })}
      </time>
    </Link>
  );
};
