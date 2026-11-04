import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { nb } from "date-fns/locale";

interface PulseTopic {
  id: string;
  slug: string;
  name: string;
  articles_last_7d: number;
}
interface PulseEntity {
  id: string;
  slug: string;
  name: string;
  type: string;
}
interface PulseArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  created_at: string;
}

const typeLabel: Record<string, string> = {
  company: "Selskap",
  person: "Person",
  product: "Produkt",
  cryptocurrency: "Krypto",
  technology: "Teknologi",
  organization: "Org",
};

// Compact 3-column "live" homepage stripe: trending entities, trending topics,
// and articles published in the last 60 minutes.
export const MarketPulse = () => {
  const [topics, setTopics] = useState<PulseTopic[]>([]);
  const [entities, setEntities] = useState<PulseEntity[]>([]);
  const [latest, setLatest] = useState<PulseArticle[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since60 = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const [t, e, l] = await Promise.all([
        supabase
          .from("topics")
          .select("id, slug, name, articles_last_7d")
          .gte("article_count", 1)
          .order("trending_score", { ascending: false })
          .limit(5),
        supabase
          .from("entities")
          .select("id, slug, name, type, trending_score")
          .gt("mention_count", 0)
          .order("trending_score", { ascending: false })
          .limit(5),
        supabase
          .from("articles")
          .select("id, slug, title, category, created_at, published")
          .eq("published", true)
          .gte("created_at", since60)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (cancelled) return;
      setTopics((t.data as any) || []);
      setEntities((e.data as any) || []);
      setLatest((l.data as any) || []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!topics.length && !entities.length && !latest.length) return null;

  return (
    <section className="mb-8 border-y border-foreground/15 py-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
        </span>
        <h2
          className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          <Activity className="h-3.5 w-3.5" />
          Markedspuls
        </h2>
        <span
          className="text-[10px] uppercase tracking-wider text-muted-foreground ml-auto"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Live · oppdateres kontinuerlig
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-x-8 gap-y-6">
        {/* Entities */}
        <div>
          <h3
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Aktører i fokus
          </h3>
          {entities.length > 0 ? (
            <ul className="space-y-1.5">
              {entities.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/entity/${e.slug}`}
                    className="flex items-baseline justify-between gap-3 group"
                  >
                    <span className="text-[13px] font-semibold group-hover:underline decoration-1 underline-offset-2 truncate">
                      {e.name}
                    </span>
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
          ) : (
            <p className="text-xs text-muted-foreground">Ingen data ennå.</p>
          )}
        </div>

        {/* Topics */}
        <div>
          <h3
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Temaer som stiger
          </h3>
          {topics.length > 0 ? (
            <ul className="space-y-1.5">
              {topics.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/topic/${t.slug}`}
                    className="flex items-baseline justify-between gap-3 group"
                  >
                    <span className="text-[13px] font-semibold group-hover:underline decoration-1 underline-offset-2 truncate">
                      {t.name}
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 tabular-nums"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                      {t.articles_last_7d || 0} / uke
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Ingen data ennå.</p>
          )}
        </div>

        {/* Last 60 min */}
        <div>
          <h3
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Siste 60 minutter
          </h3>
          {latest.length > 0 ? (
            <ul className="space-y-1.5">
              {latest.map((a) => (
                <li key={a.id}>
                  <Link to={`/${a.slug}`} className="group block">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-semibold group-hover:underline decoration-1 underline-offset-2 line-clamp-1">
                        {a.title}
                      </span>
                      <time
                        className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 tabular-nums"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                      >
                        {formatDistanceToNowStrict(new Date(a.created_at), { locale: nb })}
                      </time>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Ingen nye saker siste time.</p>
          )}
        </div>
      </div>
    </section>
  );
};
