import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  sourceType: "article" | "topic" | "entity" | "guide" | "knowledge" | "comparison" | "cluster" | "intent";
  sourceSlug: string;
  title?: string;
  limit?: number;
}

const TARGET_BASE: Record<string, string> = {
  article: "/",
  topic: "/topic/",
  entity: "/entity/",
  guide: "/guide/",
  knowledge: "/knowledge/",
  comparison: "/compare/",
  cluster: "/",
  intent: "/intent/",
};

const TARGET_LABEL: Record<string, string> = {
  article: "Les også",
  topic: "Relaterte tema",
  entity: "Relaterte selskaper",
  guide: "Guider",
  knowledge: "Forklart",
  comparison: "Sammenlign",
  cluster: "Tema-hub",
  intent: "Søkeintent",
};

export const ContextualLinks = ({ sourceType, sourceSlug, title, limit = 8 }: Props) => {
  const [links, setLinks] = useState<any[]>([]);

  useEffect(() => {
    if (!sourceSlug) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("internal_links")
        .select("target_type, target_slug, anchor, relevance_score")
        .eq("source_type", sourceType)
        .eq("source_slug", sourceSlug)
        .order("relevance_score", { ascending: false })
        .limit(limit);
      setLinks(data || []);
    })();
  }, [sourceType, sourceSlug, limit]);

  if (!links.length) return null;

  const grouped = links.reduce<Record<string, any[]>>((acc, l) => {
    (acc[l.target_type] ||= []).push(l);
    return acc;
  }, {});

  return (
    <aside className="border-t border-border pt-6 mt-10">
      {title && <h2 className="font-serif text-xl mb-4">{title}</h2>}
      <div className="grid sm:grid-cols-2 gap-6">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type}>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              {TARGET_LABEL[type] || type}
            </h3>
            <ul className="space-y-1.5">
              {items.slice(0, 5).map((l) => (
                <li key={`${type}-${l.target_slug}`}>
                  <Link
                    to={`${TARGET_BASE[type] || "/"}${l.target_slug}`}
                    className="text-sm hover:underline"
                  >
                    {l.anchor || l.target_slug}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default ContextualLinks;
