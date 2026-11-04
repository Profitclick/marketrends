import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { TrendingTopics } from "@/components/TrendingTopics";
import { TrendingEntities } from "@/components/TrendingEntities";

interface Article {
  id: string;
  title: string;
  slug: string;
  category: string;
  created_at?: string;
}

interface NewsSidebarProps {
  popularArticles: Article[];
  allTags: string[];
}

export const NewsSidebar = ({ popularArticles, allTags }: NewsSidebarProps) => {
  return (
    <aside className="space-y-10">
      <TrendingTopics variant="sidebar" limit={10} />
      {/* Mest lest */}
      <div>
        <h3
          className="text-xs font-bold uppercase tracking-widest text-foreground mb-4 pb-3 border-b-2 border-foreground"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Mest lest
        </h3>
        <ol className="divide-y divide-border">
          {popularArticles.slice(0, 8).map((article, index) => (
            <li key={article.id}>
              <Link
                to={`/${article.slug}`}
                className="group flex gap-3 py-3.5 first:pt-0"
              >
                <span
                  className="text-xl font-bold text-muted-foreground/25 w-6 flex-shrink-0 leading-none tabular-nums"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-semibold line-clamp-2 group-hover:underline decoration-1 underline-offset-2 leading-snug">
                    {article.title}
                  </h4>
                  <span
                    className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 block"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    {article.category}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      <TrendingEntities limit={10} />

      {/* Populære temaer */}
      <div>
        <h3
          className="text-xs font-bold uppercase tracking-widest text-foreground mb-4 pb-3 border-b-2 border-foreground"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Populære temaer
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {allTags.slice(0, 15).map((tag, index) => (
            <Badge
              key={index}
              variant="outline"
              className="cursor-pointer hover:bg-muted transition-colors text-[11px] px-2.5 py-1 rounded-none font-medium"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Om redaksjonen */}
      <div className="pt-6 border-t border-border">
        <h3
          className="text-xs font-bold uppercase tracking-widest text-foreground mb-3"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Om Marketrends.no
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Norges ledende kilde for finans, teknologi, krypto og markedsnyheter.
          Oppdatert døgnet rundt.
        </p>
        <Link
          to="/om-oss"
          className="text-sm text-foreground font-medium hover:underline mt-3 inline-block"
        >
          Les mer om oss →
        </Link>
      </div>
    </aside>
  );
};
