import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { ArticleCard } from "./ArticleCard";

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

interface CategoryBlockProps {
  category: string;
  articles: Article[];
  categorySlug: string;
}

export const CategoryBlock = ({ category, articles, categorySlug }: CategoryBlockProps) => {
  if (articles.length === 0) return null;

  const leadArticle = articles[0];
  const gridArticles = articles.slice(1, 4);

  return (
    <section>
      {/* Section header – DN style: bold label + thin line */}
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-border">
        <h2
          className="text-xs font-bold tracking-widest uppercase text-foreground"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {category}
        </h2>
        <Link
          to={`/kategori/${categorySlug}`}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 group"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Se alle
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Lead + grid */}
      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-1">
          <ArticleCard article={leadArticle} index={0} size="large" showIngress />
        </div>
        {gridArticles.map((article, idx) => (
          <div key={article.id} className="lg:col-span-1">
            <ArticleCard article={article} index={idx + 1} size="medium" showIngress={false} />
          </div>
        ))}
      </div>
    </section>
  );
};
