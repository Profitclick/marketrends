import { ArticleCard } from "./ArticleCard";

interface Article {
  id: string;
  title: string;
  slug: string;
  category: string;
  created_at: string;
  image_url?: string | null;
  meta_description?: string | null;
  article_type?: string | null;
}

interface QuickHeadlinesProps {
  articles: Article[];
}

export const QuickHeadlines = ({ articles }: QuickHeadlinesProps) => {
  const headlines = articles.slice(0, 6);
  if (headlines.length === 0) return null;

  return (
    <section className="mb-12 md:mb-16 pt-8 border-t border-border" aria-label="Siste overskrifter">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {headlines.map((article, idx) => (
          <ArticleCard
            key={article.id}
            article={article}
            index={idx}
            size="medium"
            showIngress={false}
          />
        ))}
      </div>
    </section>
  );
};
