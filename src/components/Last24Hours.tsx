import { Link } from "react-router-dom";
import { format, isWithinInterval, subHours } from "date-fns";
import { nb } from "date-fns/locale";
import { FreshnessBadge } from "@/components/FreshnessBadge";

interface Article {
  id: string;
  title: string;
  slug: string;
  category: string;
  created_at: string;
  image_url?: string | null;
}

interface Last24HoursProps {
  articles: Article[];
}

export const Last24Hours = ({ articles }: Last24HoursProps) => {
  const now = new Date();
  const twentyFourHoursAgo = subHours(now, 24);

  const recentArticles = articles
    .filter((article) =>
      isWithinInterval(new Date(article.created_at), { start: twentyFourHoursAgo, end: now })
    )
    .slice(0, 8);

  if (recentArticles.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-foreground">
        <h2
          className="text-xs font-bold tracking-widest uppercase"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Siste 24 timer
        </h2>
      </div>

      <ul className="divide-y divide-border">
        {recentArticles.map((article) => (
          <li key={article.id}>
            <Link
              to={`/${article.slug}`}
              className="group flex items-baseline gap-3 py-3.5 first:pt-0"
            >
              <time
                className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap flex-shrink-0"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {format(new Date(article.created_at), "HH:mm", { locale: nb })}
              </time>
              <FreshnessBadge date={article.created_at} showLabel={false} className="shrink-0" />
              <span className="text-sm font-semibold leading-snug line-clamp-2 group-hover:underline decoration-1 underline-offset-2 flex-1">
                {article.title}
              </span>
              <span
                className="text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap hidden sm:block"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {article.category}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
