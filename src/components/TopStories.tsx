import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInHours } from "date-fns";
import { nb } from "date-fns/locale";
import { TrendingUp, Clock } from "lucide-react";

interface Article {
  id: string;
  title: string;
  slug: string;
  category: string;
  image_url?: string;
  created_at: string;
  meta_description?: string;
}

interface TopStoriesProps {
  articles: Article[];
}

export const TopStories = ({ articles }: TopStoriesProps) => {
  if (articles.length === 0) return null;

  const mainArticle = articles[0];
  const sideArticles = articles.slice(1, 5);

  const getTimeBadge = (created_at: string) => {
    const hoursAgo = differenceInHours(new Date(), new Date(created_at));
    if (hoursAgo < 1) return { text: "Akkurat nå", variant: "breaking" };
    if (hoursAgo < 6) return { text: `${hoursAgo}t siden`, variant: "recent" };
    return null;
  };

  return (
    <section className="mb-10 md:mb-14">
      <div className="section-header">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-accent" />
          Toppnyheter
        </h2>
      </div>
      
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Main featured article - takes 3 columns */}
        {mainArticle && (
          <Link to={`/${mainArticle.slug}`} className="lg:col-span-3 group">
            <Card className="overflow-hidden h-full news-card">
              <div className="relative h-64 md:h-80 overflow-hidden">
                <img
                  src={mainArticle.image_url || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400"}
                  alt={mainArticle.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute top-3 left-3 flex gap-2">
                  {getTimeBadge(mainArticle.created_at) && (
                    <Badge className={`${getTimeBadge(mainArticle.created_at)?.variant === 'breaking' ? 'bg-news-breaking text-white' : 'bg-news-highlight text-foreground'} font-semibold text-xs flex items-center gap-1`}>
                      <Clock className="h-3 w-3" />
                      {getTimeBadge(mainArticle.created_at)?.text}
                    </Badge>
                  )}
                  <Badge className="bg-background/95 text-foreground shadow-md font-semibold text-xs">
                    {mainArticle.category}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-5 md:p-6">
                <h3 className="card-title-large mb-3 line-clamp-2 group-hover:text-accent transition-colors">
                  {mainArticle.title}
                </h3>
                {mainArticle.meta_description && (
                  <p className="card-excerpt line-clamp-3 mb-4">
                    {mainArticle.meta_description}
                  </p>
                )}
                <time className="card-meta uppercase tracking-wider">
                  {format(new Date(mainArticle.created_at), "d. MMM yyyy, HH:mm", { locale: nb })}
                </time>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Side articles - takes 2 columns */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {sideArticles.map((article) => {
            const timeBadge = getTimeBadge(article.created_at);
            return (
              <Link key={article.id} to={`/${article.slug}`} className="group">
                <Card className="overflow-hidden news-card">
                  <div className="flex">
                    <div className="relative w-28 md:w-32 flex-shrink-0">
                      <img
                        src={article.image_url || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=200&h=150"}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {timeBadge && (
                        <div className="absolute top-1 left-1">
                          <Badge className={`${timeBadge.variant === 'breaking' ? 'bg-news-breaking text-white' : 'bg-news-highlight text-foreground'} text-[10px] px-1.5 py-0.5`}>
                            {timeBadge.text}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3 md:p-4 flex flex-col justify-center">
                      <Badge variant="secondary" className="w-fit mb-1.5 text-[10px] px-2 py-0.5">
                        {article.category}
                      </Badge>
                      <h4 className="text-sm md:text-base font-semibold line-clamp-2 group-hover:text-accent transition-colors leading-snug">
                        {article.title}
                      </h4>
                      <time className="text-xs text-muted-foreground mt-1.5">
                        {format(new Date(article.created_at), "d. MMM, HH:mm", { locale: nb })}
                      </time>
                    </CardContent>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};
