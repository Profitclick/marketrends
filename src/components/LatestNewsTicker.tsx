import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface Article {
  id: string;
  title: string;
  slug: string;
  created_at: string;
}

interface LatestNewsTickerProps {
  articles: Article[];
}

export const LatestNewsTicker = ({ articles }: LatestNewsTickerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (articles.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % articles.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [articles.length]);

  if (articles.length === 0) return null;

  const currentArticle = articles[currentIndex];

  return (
    <div className="bg-muted border-b border-border">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex items-center gap-4 py-2.5">
          <span
            className="text-[11px] font-bold uppercase tracking-widest text-destructive whitespace-nowrap"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Siste nytt
          </span>
          <span className="w-px h-3.5 bg-border" />
          <div className="flex-1 overflow-hidden">
            <Link to={`/${currentArticle.slug}`} className="flex items-center gap-3 group">
              <span
                className="text-[11px] text-muted-foreground tabular-nums shrink-0"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {format(new Date(currentArticle.created_at), "HH:mm", { locale: nb })}
              </span>
              <span className="text-[13px] font-medium text-foreground truncate group-hover:underline">
                {currentArticle.title}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
