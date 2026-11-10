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
      // topic_relations has no PostgREST FK relationship to topics, so resolve in two steps.
      const { data: relations } = await supabase
        .from("topic_relations")
        .select("related_topic_id, score")
        .eq("topic_id", topicId)
        .order("score", { ascending: false })
        .limit(8);
      if (cancelled) return;

      const ids = (relations || []).map((r) => r.related_topic_id);
      if (!ids.length) {
        setTopics([]);
        return;
      }

      const { data: topicRows } = await supabase
        .from("topics")
        .select("id, slug, name, article_count")
        .in("id", ids);
      if (cancelled) return;

      const byId = new Map((topicRows || []).map((topic) => [topic.id, topic]));
      const list: RelatedTopic[] = ids
        .map((id) => byId.get(id))
        .filter((topic): topic is NonNullable<typeof topic> => Boolean(topic))
        .map(({ slug, name, article_count }) => ({ slug, name, article_count }));
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
