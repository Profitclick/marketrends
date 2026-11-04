import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface Article {
  id: string;
  title: string;
  slug: string;
  category: string;
  image_url?: string;
  created_at: string;
  meta_description?: string;
}

interface CategorySectionProps {
  category: string;
  articles: Article[];
}

export const CategorySection = ({ category, articles }: CategorySectionProps) => {
  if (articles.length === 0) return null;

  return (
    <section className="mb-10 md:mb-14">
      <div className="section-header">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">{category}</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {articles.slice(0, 4).map((article, idx) => (
          <Link key={article.id} to={`/${article.slug}`} className="group">
            <Card className="overflow-hidden h-full news-card">
              <div className="relative h-40 md:h-44 overflow-hidden">
                <img
                  src={article.image_url || `https://images.unsplash.com/photo-${1460925895917 + (idx * 1000)}-afdab827c52f?w=400&h=300`}
                  alt={article.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <CardContent className="p-4 md:p-5">
                <h3 className="card-title text-base md:text-lg mb-2 line-clamp-3 group-hover:text-accent transition-colors">
                  {article.title}
                </h3>
                <time className="card-meta text-xs uppercase tracking-wider">
                  {format(new Date(article.created_at), "d. MMM yyyy", { locale: nb })}
                </time>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};