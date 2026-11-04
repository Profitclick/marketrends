import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const SourcesPanel = ({ articleId }: { articleId?: string }) => {
  const [sources, setSources] = useState<any[]>([]);

  useEffect(() => {
    if (!articleId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("source_library")
        .select("id, title, url, publisher, published_at")
        .eq("article_id", articleId)
        .limit(15);
      setSources(data || []);
    })();
  }, [articleId]);

  if (!sources.length) return null;

  return (
    <section className="border-t border-border pt-6 mt-10">
      <h2 className="font-serif text-xl mb-3">Kilder</h2>
      <ol className="list-decimal pl-5 space-y-1.5 text-sm">
        {sources.map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">
              {s.title || s.url}
            </a>
            {s.publisher && <span className="text-muted-foreground"> — {s.publisher}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
};

export default SourcesPanel;
