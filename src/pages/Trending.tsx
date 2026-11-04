import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { MarketTicker } from "@/components/MarketTicker";
import { LatestNewsTicker } from "@/components/LatestNewsTicker";
import { NewsFooter } from "@/components/NewsFooter";
import { SEOHead } from "@/components/SEOHead";
import { MostReadToday } from "@/components/MostReadToday";
import { MostReadThisWeek } from "@/components/MostReadThisWeek";
import { Flame, TrendingUp, Activity, Zap, Coins, Cpu } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { nb } from "date-fns/locale";
import { getCategoryFallbackImage } from "@/utils/seo";

const BASE = "https://marketrends.no";

interface TopicRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  article_count: number;
  articles_last_7d: number;
  trending_score: number | null;
  momentum_score: number | null;
  velocity_score: number | null;
}

interface EntityRow {
  id: string;
  slug: string;
  name: string;
  type: string;
  mention_count: number;
  mentions_last_24h: number | null;
  mentions_last_7d: number | null;
  trending_score: number | null;
  momentum_score: number | null;
}

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  image_url: string | null;
  meta_description: string | null;
  created_at: string;
}

const Trending = () => {
  const [trendingNow, setTrendingNow] = useState<ArticleRow[]>([]);
  const [risingTopics, setRisingTopics] = useState<TopicRow[]>([]);
  const [growingTopics, setGrowingTopics] = useState<TopicRow[]>([]);
  const [trendingEntities, setTrendingEntities] = useState<EntityRow[]>([]);
  const [cryptoEntities, setCryptoEntities] = useState<EntityRow[]>([]);
  const [aiEntities, setAiEntities] = useState<EntityRow[]>([]);
  const [tickerArticles, setTickerArticles] = useState<ArticleRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [recentArts, risingT, growingT, topE, cryptoE, aiE] = await Promise.all([
        supabase
          .from("articles")
          .select("id, slug, title, category, image_url, meta_description, created_at, published")
          .eq("published", true)
          .gte("created_at", since24)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("topics")
          .select("id, slug, name, description, article_count, articles_last_7d, trending_score, momentum_score, velocity_score")
          .gte("article_count", 1)
          .order("momentum_score", { ascending: false, nullsFirst: false })
          .limit(8),
        supabase
          .from("topics")
          .select("id, slug, name, description, article_count, articles_last_7d, trending_score, momentum_score, velocity_score")
          .gte("article_count", 1)
          .order("velocity_score", { ascending: false, nullsFirst: false })
          .limit(8),
        supabase
          .from("entities")
          .select("id, slug, name, type, mention_count, mentions_last_24h, mentions_last_7d, trending_score, momentum_score")
          .gt("mention_count", 0)
          .order("trending_score", { ascending: false, nullsFirst: false })
          .limit(12),
        supabase
          .from("entities")
          .select("id, slug, name, type, mention_count, mentions_last_24h, mentions_last_7d, trending_score, momentum_score")
          .eq("type", "cryptocurrency")
          .gt("mention_count", 0)
          .order("trending_score", { ascending: false, nullsFirst: false })
          .limit(8),
        supabase
          .from("entities")
          .select("id, slug, name, type, mention_count, mentions_last_24h, mentions_last_7d, trending_score, momentum_score")
          .in("type", ["technology", "product", "company"])
          .gt("mention_count", 0)
          .order("trending_score", { ascending: false, nullsFirst: false })
          .limit(8),
      ]);

      if (cancelled) return;
      const arts = ((recentArts.data as any) || []) as ArticleRow[];
      setTickerArticles(arts.slice(0, 10));

      // Trending now = recent 24h + boost by article_relations count
      const ids = arts.map((a) => a.id);
      let ranked = arts;
      if (ids.length) {
        const { data: rels } = await supabase
          .from("article_relations")
          .select("article_id, related_article_id")
          .or(`article_id.in.(${ids.join(",")}),related_article_id.in.(${ids.join(",")})`)
          .limit(2000);
        const counts = new Map<string, number>();
        ((rels as any) || []).forEach((r: any) => {
          if (ids.includes(r.article_id)) counts.set(r.article_id, (counts.get(r.article_id) || 0) + 1);
          if (ids.includes(r.related_article_id))
            counts.set(r.related_article_id, (counts.get(r.related_article_id) || 0) + 1);
        });
        ranked = [...arts].sort((a, b) => {
          const ca = counts.get(a.id) || 0;
          const cb = counts.get(b.id) || 0;
          if (cb !== ca) return cb - ca;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }
      setTrendingNow(ranked.slice(0, 8));

      setRisingTopics(((risingT.data as any) || []) as TopicRow[]);
      setGrowingTopics(((growingT.data as any) || []) as TopicRow[]);
      setTrendingEntities(((topE.data as any) || []) as EntityRow[]);
      setCryptoEntities(((cryptoE.data as any) || []) as EntityRow[]);
      setAiEntities(((aiE.data as any) || []) as EntityRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title="Trending nå – Hva beveger markedet i dag?"
        description="Sanntidsoversikt over de mest leste artiklene, raskest voksende temaene og mest omtalte aktørene innen finans, krypto, AI og teknologi i Norge."
        canonicalUrl={`${BASE}/trending`}
        ogType="website"
      />
      <MarketTicker />
      <Navigation />
      <LatestNewsTicker articles={tickerArticles as any} />

      <main className="max-w-[1200px] mx-auto px-4 py-10">
        <header className="mb-10 pb-6 border-b-2 border-foreground">
          <div className="flex items-center gap-2 mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-destructive">
              Live · Markedspuls
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold leading-[1.05] mb-3">
            Trending nå
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Hva er det norske finans- og teknologi-Norge snakker om akkurat nå?
            Sanntidsoversikt over de varmeste sakene, raskest voksende temaene og mest omtalte aktørene.
          </p>
        </header>

        {/* Trending now */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-5 pb-3 border-b-2 border-foreground">
            <h2
              className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <Flame className="h-4 w-4 text-destructive" />
              Trending nå
            </h2>
            <span
              className="text-[10px] uppercase tracking-wider text-muted-foreground"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Siste 24 timer
            </span>
          </div>
          {trendingNow.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen ferske saker akkurat nå.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {trendingNow.map((a, i) => (
                <Link key={a.id} to={`/${a.slug}`} className="group block">
                  <div className="overflow-hidden mb-2.5">
                    <img
                      src={a.image_url || getCategoryFallbackImage(a.category, i)}
                      alt={a.title}
                      loading="lazy"
                      className="w-full aspect-[4/3] object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest text-destructive"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                      {a.category}
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-wider text-muted-foreground"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                      {formatDistanceToNowStrict(new Date(a.created_at), { locale: nb })}
                    </span>
                  </div>
                  <h3 className="font-serif text-base md:text-lg font-bold leading-tight group-hover:underline decoration-1 underline-offset-2 line-clamp-3">
                    {a.title}
                  </h3>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Two-column trending topics */}
        <section className="grid md:grid-cols-2 gap-x-10 gap-y-10 mb-14">
          <div>
            <h2
              className="text-xs font-bold uppercase tracking-widest mb-5 pb-3 border-b-2 border-foreground flex items-center gap-2"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <Zap className="h-4 w-4" />
              Stiger raskt
            </h2>
            <TopicList rows={risingTopics} metric="momentum" />
          </div>
          <div>
            <h2
              className="text-xs font-bold uppercase tracking-widest mb-5 pb-3 border-b-2 border-foreground flex items-center gap-2"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <TrendingUp className="h-4 w-4" />
              Fastest growing temaer
            </h2>
            <TopicList rows={growingTopics} metric="velocity" />
          </div>
        </section>

        {/* Most read */}
        <section className="grid md:grid-cols-2 gap-x-10 gap-y-10 mb-14">
          <MostReadToday limit={6} />
          <MostReadThisWeek limit={6} />
        </section>

        {/* Trending entities */}
        <section className="mb-14">
          <h2
            className="text-xs font-bold uppercase tracking-widest mb-5 pb-3 border-b-2 border-foreground flex items-center gap-2"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            <Activity className="h-4 w-4" />
            Trending selskaper og aktører
          </h2>
          <EntityGrid rows={trendingEntities} />
        </section>

        <section className="grid md:grid-cols-2 gap-x-10 gap-y-10 mb-14">
          <div>
            <h2
              className="text-xs font-bold uppercase tracking-widest mb-5 pb-3 border-b-2 border-foreground flex items-center gap-2"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <Coins className="h-4 w-4" />
              Trending krypto
            </h2>
            <EntityList rows={cryptoEntities} />
          </div>
          <div>
            <h2
              className="text-xs font-bold uppercase tracking-widest mb-5 pb-3 border-b-2 border-foreground flex items-center gap-2"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <Cpu className="h-4 w-4" />
              Trending AI &amp; teknologi
            </h2>
            <EntityList rows={aiEntities} />
          </div>
        </section>
      </main>

      <NewsFooter />
    </div>
  );
};

const TopicList = ({
  rows,
  metric,
}: {
  rows: TopicRow[];
  metric: "momentum" | "velocity";
}) => {
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">Ingen data ennå.</p>;
  return (
    <ol className="divide-y divide-border">
      {rows.map((t, i) => (
        <li key={t.id}>
          <Link to={`/topic/${t.slug}`} className="group flex gap-3 py-3.5 first:pt-0">
            <span
              className="font-serif text-2xl font-bold text-muted-foreground/30 w-8 shrink-0 leading-none tabular-nums"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-[15px] font-semibold leading-snug group-hover:underline decoration-1 underline-offset-2">
                {t.name}
              </h4>
              {t.description && (
                <p className="text-[12px] text-muted-foreground line-clamp-1 mt-0.5">
                  {t.description}
                </p>
              )}
            </div>
            <span
              className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 tabular-nums"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {metric === "momentum"
                ? `${(t.momentum_score ?? 0).toFixed(1)}×`
                : `${t.articles_last_7d ?? 0} / uke`}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
};

const typeLabel: Record<string, string> = {
  company: "Selskap",
  person: "Person",
  product: "Produkt",
  cryptocurrency: "Krypto",
  technology: "Teknologi",
  organization: "Organisasjon",
};

const EntityGrid = ({ rows }: { rows: EntityRow[] }) => {
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">Ingen data ennå.</p>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
      {rows.map((e, i) => (
        <Link
          key={e.id}
          to={`/entity/${e.slug}`}
          className="group flex items-baseline justify-between gap-3 border-b border-border pb-3"
        >
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              className="font-serif text-base font-bold text-muted-foreground/40 tabular-nums shrink-0"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[14px] font-semibold group-hover:underline decoration-1 underline-offset-2 truncate">
              {e.name}
            </span>
          </div>
          <div
            className="flex items-center gap-2 shrink-0"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {typeLabel[e.type] || e.type}
            </span>
            <span className="text-[10px] tabular-nums text-foreground/80">
              {e.mentions_last_24h ?? 0}/24t
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
};

const EntityList = ({ rows }: { rows: EntityRow[] }) => {
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">Ingen data ennå.</p>;
  return (
    <ol className="divide-y divide-border">
      {rows.map((e, i) => (
        <li key={e.id}>
          <Link to={`/entity/${e.slug}`} className="group flex items-baseline gap-3 py-3 first:pt-0">
            <span
              className="font-serif text-lg font-bold text-muted-foreground/40 w-6 shrink-0 tabular-nums"
            >
              {i + 1}
            </span>
            <span className="flex-1 text-[14px] font-semibold group-hover:underline decoration-1 underline-offset-2 truncate">
              {e.name}
            </span>
            <span
              className="text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {e.mentions_last_7d ?? 0} / uke
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
};

export default Trending;
