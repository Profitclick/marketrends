import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Flame, TrendingUp } from "lucide-react";

interface TopicCard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  article_count: number;
  articles_last_7d: number;
  hero_article_id: string | null;
  category_hint: string | null;
}

interface LatestArticle {
  id: string;
  title: string;
  slug: string;
}

interface Props {
  limit?: number;
  title?: string;
  categoryHints?: string[];
  showLatest?: boolean;
}

export const TopicHubGrid = ({ limit = 6, title = "Trending temaer", categoryHints, showLatest = true }: Props) => {
  const [topics, setTopics] = useState<TopicCard[]>([]);
  const [latest, setLatest] = useState<Record<string, LatestArticle | undefined>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("topics")
        .select("id, slug, name, description, article_count, articles_last_7d, hero_article_id, category_hint")
        .gte("article_count", 1)
        .order("trending_score", { ascending: false })
        .limit(limit);
      if (categoryHints?.length) q = q.in("category_hint", categoryHints);
      const { data } = await q;
      if (cancelled) return;
      const list = data || [];
      setTopics(list);

      // Fetch one latest article per topic
      if (showLatest && list.length) {
        const heroIds = list.map((t) => t.hero_article_id).filter(Boolean) as string[];
        if (heroIds.length) {
          const { data: arts } = await supabase
            .from("articles")
            .select("id, title, slug")
            .in("id", heroIds);
          if (cancelled) return;
          const map: Record<string, LatestArticle> = {};
          (arts || []).forEach((a) => { map[a.id] = a; });
          const byTopic: Record<string, LatestArticle | undefined> = {};
          list.forEach((t) => { if (t.hero_article_id) byTopic[t.id] = map[t.hero_article_id]; });
          setLatest(byTopic);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [limit, showLatest, JSON.stringify(categoryHints)]);

  if (!topics.length) return null;

  return (
    <section className="my-12 py-2">
      <div className="flex items-center justify-between mb-6 pb-3 border-b-2 border-foreground">
        <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ fontFamily: "'Inter', sans-serif" }}>
          <TrendingUp className="h-4 w-4" />
          {title}
        </h2>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
          {topics.length} aktive
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
        {topics.map((t) => {
          const hot = t.articles_last_7d >= 3;
          const headline = latest[t.id];
          return (
            <Link key={t.id} to={`/topic/${t.slug}`} className="group block border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Tema
                </span>
                {hot && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-destructive" style={{ fontFamily: "'Inter', sans-serif" }}>
                    <Flame className="h-3 w-3" />Hot
                  </span>
                )}
                <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {t.article_count} artikler
                </span>
              </div>
              <h3 className="font-serif text-xl md:text-2xl font-bold leading-tight group-hover:underline decoration-1 underline-offset-4 mb-2">
                {t.name}
              </h3>
              {headline && (
                <p className="text-[13px] text-muted-foreground line-clamp-2 leading-snug">
                  → {headline.title}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
};
