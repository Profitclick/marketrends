import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface Article {
  id: string;
  title: string;
  slug: string;
  category: string;
  created_at: string;
  image_url?: string | null;
}

interface PopularNowProps {
  articles: Article[];
}

export const PopularNow = ({ articles }: PopularNowProps) => {
  // Just use the 5 most recent articles – no extra DB query needed
  const displayArticles = articles.slice(0, 5);

  if (displayArticles.length === 0) return null;

  return (
    <section className="mb-10 md:mb-14">
      <div className="section-header">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Flame className="h-5 w-5 text-news-breaking" />
          Populært nå
        </h2>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {displayArticles.map((article, index) => (
          <Link 
            key={article.id} 
            to={`/${article.slug}`} 
            className="group"
          >
            <Card className={`news-card h-full ${index === 0 ? 'sm:col-span-2 lg:col-span-2' : ''}`}>
              <div className={`relative overflow-hidden ${index === 0 ? 'h-48 sm:h-56' : 'h-32'}`}>
                <img
                  src={article.image_url || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300"}
                  alt={article.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <Badge className="bg-news-breaking text-white text-xs font-bold flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    #{index + 1}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-3 md:p-4">
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 mb-2">
                  {article.category}
                </Badge>
                <h3 className={`font-semibold leading-snug line-clamp-2 group-hover:text-accent transition-colors ${index === 0 ? 'text-base md:text-lg' : 'text-sm'}`}>
                  {article.title}
                </h3>
                <time className="text-xs text-muted-foreground mt-2 block">
                  {format(new Date(article.created_at), "d. MMM", { locale: nb })}
                </time>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};
