import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { format, differenceInHours } from "date-fns";
import { nb } from "date-fns/locale";
import { Flame, Clock } from "lucide-react";

interface ArticleHeroProps {
  title: string;
  category: string;
  slug: string;
  image_url?: string;
  created_at: string;
  meta_description?: string;
}

export const ArticleHero = ({ title, category, slug, image_url, created_at, meta_description }: ArticleHeroProps) => {
  const hoursAgo = differenceInHours(new Date(), new Date(created_at));
  const isRecent = hoursAgo < 6;
  const isBreaking = hoursAgo < 2;

  return (
    <Link to={`/${slug}`} className="block group mb-10 md:mb-12">
      <div className="relative h-[400px] md:h-[500px] lg:h-[550px] rounded-xl overflow-hidden shadow-xl">
        <img
          src={image_url || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=630"}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 text-white">
          <div className="flex items-center gap-3 mb-4">
            {isBreaking && (
              <Badge className="bg-news-breaking text-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider breaking-news-badge flex items-center gap-1.5">
                <Flame className="h-3 w-3" />
                Akkurat nå
              </Badge>
            )}
            {!isBreaking && isRecent && (
              <Badge className="bg-news-highlight text-foreground px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Nytt
              </Badge>
            )}
            <Badge className="bg-accent text-accent-foreground px-4 py-1.5 text-sm font-semibold shadow-lg">
              {category}
            </Badge>
          </div>
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight tracking-tight text-balance">
            {title}
          </h1>
          {meta_description && (
            <p className="text-base md:text-xl text-gray-100 mb-4 line-clamp-2 max-w-4xl font-light">
              {meta_description}
            </p>
          )}
          <time className="text-sm text-gray-300 font-medium">
            {format(new Date(created_at), "d. MMMM yyyy, HH:mm", { locale: nb })}
          </time>
        </div>
      </div>
    </Link>
  );
};