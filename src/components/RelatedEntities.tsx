import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";

interface Related {
  id: string;
  slug: string;
  name: string;
  type: string;
  score: number;
}

const typeLabel: Record<string, string> = {
  company: "Selskap", person: "Person", product: "Produkt",
  location: "Sted", organization: "Organisasjon", technology: "Teknologi",
  cryptocurrency: "Krypto", asset: "Eiendel", government: "Myndighet",
};

export const RelatedEntities = ({ entityId, limit = 8 }: { entityId: string; limit?: number }) => {
  const [items, setItems] = useState<Related[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("entity_relations")
        .select("score, entities!entity_relations_related_entity_id_fkey(id, slug, name, type)")
        .eq("entity_id", entityId)
        .order("score", { ascending: false })
        .limit(limit);
      if (cancelled) return;
      const mapped = (data || [])
        .map((r: any) => r.entities ? { ...r.entities, score: r.score } : null)
        .filter(Boolean) as Related[];
      setItems(mapped);
    })();
    return () => { cancelled = true; };
  }, [entityId, limit]);

  if (!items.length) return null;

  return (
    <div>
      <h3
        className="text-xs font-bold uppercase tracking-widest mb-4 pb-3 border-b-2 border-foreground flex items-center gap-2"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <Users className="h-3.5 w-3.5" /> Ofte nevnt sammen
      </h3>
      <ul className="divide-y divide-border">
        {items.map((e) => (
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
