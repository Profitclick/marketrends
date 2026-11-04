import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Article { id: string; title: string; slug: string; created_at: string }
interface TopicInfo { id: string; slug: string; name: string }

export const MoreAboutTopic = ({ articleId }: { articleId: string }) => {
  const [topic, setTopic] = useState<TopicInfo | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Pick highest-relevance topic for this article
      const { data: at } = await supabase
        .from("article_topics")
        .select("relevance_score, topics!inner(id, slug, name)")
        .eq("article_id", articleId)
        .order("relevance_score", { ascending: false })
        .limit(1);
      const t = (at || [])[0]?.topics as any;
      if (!t || cancelled) return;
      setTopic(t);

      const { data: rows } = await supabase
        .from("article_topics")
        .select("articles!inner(id, title, slug, created_at, published)")
        .eq("topic_id", t.id)
        .limit(20);
      const arts = (rows || [])
        .map((r: any) => r.articles)
        .filter((a: any) => a && a.published && a.id !== articleId)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
      if (cancelled) return;
      setArticles(arts);
    })();
    return () => { cancelled = true; };
  }, [articleId]);

  if (!topic || !articles.length) return null;

  return (
    <div className="border-t-2 border-foreground pt-5 mt-8">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "'Inter', sans-serif" }}>
          Mer om {topic.name}
        </h3>
        <Link to={`/topic/${topic.slug}`} className="text-[11px] font-semibold uppercase tracking-wider hover:underline" style={{ fontFamily: "'Inter', sans-serif" }}>
          Se alle →
        </Link>
      </div>
      <div className="divide-y divide-border">
        {articles.map((a) => (
          <Link key={a.id} to={`/${a.slug}`} className="block py-3 group">
            <h4 className="text-[14px] font-semibold leading-snug group-hover:underline decoration-1 underline-offset-2 line-clamp-2">
              {a.title}
            </h4>
          </Link>
        ))}
      </div>
    </div>
  );
};
