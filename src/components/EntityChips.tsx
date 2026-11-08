import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Chip { id: string; slug: string; name: string; type: string; }

export const EntityChips = ({ articleId, className }: { articleId: string; className?: string }) => {
  const [items, setItems] = useState<Chip[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("article_entities")
        .select("is_primary, mention_count, entities!inner(id, slug, name, type)")
        .eq("article_id", articleId)
        .order("is_primary", { ascending: false })
        .order("mention_count", { ascending: false })
        .limit(6);
      setItems((data || []).map((r) => r.entities).filter(Boolean));
    })();
  }, [articleId]);
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className || ""}`}>
      {items.map((e) => (
        <Link
          key={e.id}
          to={`/entity/${e.slug}`}
          className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 border border-border hover:border-foreground hover:bg-foreground hover:text-background transition-colors"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {e.name}
        </Link>
      ))}
    </div>
  );
};
