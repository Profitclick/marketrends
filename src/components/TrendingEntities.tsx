import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";

interface Entity {
  id: string;
  slug: string;
  name: string;
  type: string;
  mention_count: number;
}

interface Props {
  limit?: number;
}

const typeLabel: Record<string, string> = {
  company: "Selskap",
  person: "Person",
  product: "Produkt",
  location: "Sted",
  organization: "Organisasjon",
  technology: "Teknologi",
  cryptocurrency: "Krypto",
  asset: "Eiendel",
};

export const TrendingEntities = ({ limit = 10 }: Props) => {
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Find entities most-mentioned in the last 14 days (proxy for "trending")
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: ae } = await supabase
        .from("article_entities")
        .select("entity_id, created_at, entities!inner(id, slug, name, type, mention_count)")
        .gte("created_at", since)
        .limit(500);
      if (cancelled) return;
      const counts = new Map<string, { ent: Entity; recent: number }>();
      (ae || []).forEach((r: any) => {
        const e = r.entities;
        if (!e) return;
        const cur = counts.get(e.id);
        if (cur) cur.recent++;
        else counts.set(e.id, { ent: e, recent: 1 });
      });
      const top = [...counts.values()]
        .sort((a, b) => b.recent - a.recent || b.ent.mention_count - a.ent.mention_count)
        .slice(0, limit)
        .map((x) => x.ent);
      setEntities(top);
    })();
    return () => { cancelled = true; };
  }, [limit]);

  if (!entities.length) return null;

  return (
    <div>
      <h3
        className="text-xs font-bold uppercase tracking-widest mb-4 pb-3 border-b-2 border-foreground flex items-center gap-2"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <Activity className="h-3.5 w-3.5" />
        Aktive aktører
      </h3>
      <ul className="divide-y divide-border">
        {entities.map((e) => (
          <li key={e.id} className="py-2.5">
            <Link to={`/entity/${e.slug}`} className="flex items-baseline justify-between gap-3 group">
              <span className="text-[13px] font-semibold leading-snug group-hover:underline">{e.name}</span>
              <span
                className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {typeLabel[e.type] || e.type}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};
