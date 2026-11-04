import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp } from "lucide-react";

interface E { id: string; slug: string; name: string; momentum_score: number; mentions_last_24h: number; }

export const TrendingEntitiesBar = ({ limit = 8 }: { limit?: number }) => {
  const [items, setItems] = useState<E[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("entities")
        .select("id, slug, name, momentum_score, mentions_last_24h")
        .gt("mentions_last_24h", 0)
        .order("momentum_score", { ascending: false })
        .limit(limit);
      setItems((data as any) || []);
    })();
  }, [limit]);
  if (!items.length) return null;
  return (
    <div className="border-y border-border bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 overflow-x-auto">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest shrink-0">
          <TrendingUp className="h-3 w-3" /> I bevegelse
        </span>
        <ul className="flex items-center gap-4 text-xs">
          {items.map((e) => (
            <li key={e.id} className="shrink-0">
              <Link to={`/entity/${e.slug}`} className="font-semibold hover:underline">
                {e.name}
              </Link>
              <span className="ml-1.5 text-[10px] text-muted-foreground">+{e.mentions_last_24h}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
