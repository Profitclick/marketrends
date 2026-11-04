import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface TopicChip {
  id: string;
  slug: string;
  name: string;
}

interface Props {
  articleId: string;
  className?: string;
}

export const TopicChips = ({ articleId, className }: Props) => {
  const [topics, setTopics] = useState<TopicChip[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("article_topics")
        .select("relevance_score, topics!inner(id, slug, name)")
        .eq("article_id", articleId)
        .order("relevance_score", { ascending: false })
        .limit(5);
      if (cancelled) return;
      const list = (data || [])
        .map((r: any) => r.topics)
        .filter(Boolean);
      setTopics(list);
    })();
    return () => { cancelled = true; };
  }, [articleId]);

  if (!topics.length) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className || ""}`}>
      {topics.map((t) => (
        <Link
          key={t.id}
          to={`/topic/${t.slug}`}
          className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 border border-border hover:border-foreground hover:bg-foreground hover:text-background transition-colors"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {t.name}
        </Link>
      ))}
    </div>
  );
};
