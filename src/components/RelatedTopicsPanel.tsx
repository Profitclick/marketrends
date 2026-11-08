import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface RelatedTopic {
  slug: string;
  name: string;
  article_count: number;
}

export const RelatedTopicsPanel = ({ topicId }: { topicId: string }) => {
  const [topics, setTopics] = useState<RelatedTopic[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("topic_relations")
        .select("score, topics:related_topic_id (slug, name, article_count)")
        .eq("topic_id", topicId)
        .order("score", { ascending: false })
        .limit(8);
      if (cancelled) return;
      const list = (data || [])
        .map((r) => r.topics)
        .filter(Boolean);
      setTopics(list);
    })();
    return () => { cancelled = true; };
  }, [topicId]);

  if (!topics.length) return null;

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest mb-4 pb-3 border-b-2 border-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
        Relaterte temaer
      </h3>
      <div className="flex flex-wrap gap-2">
        {topics.map((s) => (
          <Link
            key={s.slug}
            to={`/topic/${s.slug}`}
            className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 border border-border hover:border-foreground hover:bg-foreground hover:text-background transition-colors"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {s.name}
            <span className="ml-1.5 text-muted-foreground">{s.article_count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};
