import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp } from "lucide-react";

interface Topic {
  id: string;
  slug: string;
  name: string;
  article_count: number;
  articles_last_7d?: number;
}

interface Props {
  limit?: number;
  variant?: "homepage" | "sidebar";
}

export const TrendingTopics = ({ limit = 8, variant = "homepage" }: Props) => {
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("topics")
        .select("id, slug, name, article_count, articles_last_7d")
        .gte("article_count", 1)
        .order("trending_score", { ascending: false })
        .limit(limit);
      if (cancelled) return;
      setTopics(data || []);
    })();
    return () => { cancelled = true; };
  }, [limit]);

  if (!topics.length) return null;

  if (variant === "sidebar") {
    return (
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground mb-4 pb-3 border-b-2 border-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
          Populære temaer
        </h3>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <Link
              key={t.id}
              to={`/topic/${t.slug}`}
              className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 border border-border hover:border-foreground hover:bg-foreground hover:text-background transition-colors"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {t.name}
              <span className="ml-1.5 text-muted-foreground group-hover:text-background">{t.article_count}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="my-10 py-6 border-y border-border">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4" />
        <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ fontFamily: "'Inter', sans-serif" }}>
          Trender nå
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {topics.map((t) => (
          <Link
            key={t.id}
            to={`/topic/${t.slug}`}
            className="group inline-flex items-center text-[12px] font-semibold px-3 py-1.5 border border-border hover:border-foreground hover:bg-foreground hover:text-background transition-colors"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {t.name}
            <span className="ml-2 text-[10px] text-muted-foreground group-hover:text-background/80">{t.article_count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
};
