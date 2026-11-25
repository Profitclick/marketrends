import { formatOsloDate } from "@/lib/osloDate";
import { useRenderClock } from "@/lib/renderClock";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  loadTopicRouteData,
  type TopicRouteArticle,
  type TopicRouteEntity,
  type TopicRouteTopic,
  type TopicRouteData,
} from "@/lib/routeData";
import { topicMetadata } from "@/lib/routeMetadata";
import { Navigation } from "@/components/Navigation";
import { MarketTicker } from "@/components/MarketTicker";
import { LatestNewsTicker } from "@/components/LatestNewsTicker";
import { NewsFooter } from "@/components/NewsFooter";
import { ArticleCard } from "@/components/ArticleCard";
import { SEOHead } from "@/components/SEOHead";
import { RelatedTopicsPanel } from "@/components/RelatedTopicsPanel";
import { DiscoveryFooter } from "@/components/DiscoveryFooter";
import { ContextualLinks } from "@/components/ContextualLinks";
import { Skeleton } from "@/components/ui/skeleton";
import { Home, ChevronRight, Flame } from "lucide-react";
import { getCategoryFallbackImage } from "@/utils/seo";
import { getDisplayedTopicArticleCount } from "@/utils/topicCounts";

const TopicPage = ({ initialData }: { initialData?: TopicRouteData } = {}) => {
  const { slug } = useParams();
  const now = useRenderClock();
  const [topic, setTopic] = useState<TopicRouteTopic | null>(initialData?.topic ?? null);
  const [articles, setArticles] = useState<TopicRouteArticle[]>(initialData?.articles ?? []);
  const [hero, setHero] = useState<TopicRouteArticle | null>(initialData?.hero ?? null);
  const [explainer, setExplainer] = useState<TopicRouteArticle | null>(initialData?.explainer ?? null);
  const [entities, setEntities] = useState<TopicRouteEntity[]>(initialData?.entities ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    loadTopicRouteData(supabase, slug)
      .then((result) => {
        if (cancelled) return;
        if (result.status !== "found") {
          setNotFound(true);
          setTopic(null);
          setArticles([]);
          setHero(null);
          setExplainer(null);
          setEntities([]);
          return;
        }

        setTopic(result.data.topic);
        setArticles(result.data.articles);
        setHero(result.data.hero);
        setExplainer(result.data.explainer);
        setEntities(result.data.entities);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Error loading topic route:", error);
          setNotFound(true);
          setTopic(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug, initialData]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-background">
        <MarketTicker />
        <Navigation />
        <div className="max-w-[1200px] mx-auto px-4 py-12">
          <Skeleton className="h-12 w-2/3 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <Skeleton className="aspect-video w-full" />
        </div>
        <NewsFooter />
      </div>
    );
  }

  if (notFound || !topic) {
    return (
      <div className="min-h-dvh bg-background">
        <MarketTicker />
        <Navigation />
        <div className="max-w-[1200px] mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-serif mb-4">Tema ikke funnet</h1>
          <p className="text-muted-foreground mb-6">Dette temaet eksisterer ikke ennå, eller har ingen artikler.</p>
          <Link to="/" className="text-primary underline">Tilbake til forsiden</Link>
        </div>
        <NewsFooter />
      </div>
    );
  }

  const heroExclId = new Set<string>([hero?.id, explainer?.id].filter(Boolean) as string[]);
  const latest = articles.filter((a) => !heroExclId.has(a.id)).slice(0, 10);
  const mostRelevant = articles.filter((a) => !heroExclId.has(a.id)).slice(0, 5);
  const guides = articles.filter((a) => a.article_type === "guide" && a.id !== explainer?.id).slice(0, 3);
  const recommended = articles.filter((a) => !heroExclId.has(a.id)).slice(10, 14);
  const trending = articles.filter((a) => {
    const days = (now - new Date(a.created_at).getTime()) / 86400000;
    return days < 7;
  }).slice(0, 6);

  const displayedArticleCount = getDisplayedTopicArticleCount(topic.article_count, articles.length);
  const isHot = topic.articles_last_7d >= 3;
  const lastUpdatedRel = topic.last_article_at
    ? formatOsloDate(topic.last_article_at, "d. MMM yyyy")
    : null;

  const seo = topicMetadata(topic, articles, hero, entities);


  return (
    <div className="min-h-dvh bg-background">
      <SEOHead {...seo} />

      <MarketTicker />
      <Navigation />
      <LatestNewsTicker articles={articles.slice(0, 10) as any} />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <nav className="flex items-center gap-2 text-[12px] text-muted-foreground mb-7" style={{ fontFamily: "'Inter', sans-serif" }}>
          <Link to="/" className="hover:text-foreground flex items-center gap-1"><Home className="h-3.5 w-3.5" />Hjem</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="uppercase tracking-wider">Tema</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{topic.name}</span>
        </nav>

        {/* Topic Hero */}
        <header className="mb-12 pb-9 border-b border-border">
          <div className="flex items-center gap-3 mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
            <span className="text-[11px] font-bold uppercase tracking-widest text-destructive">
              Tema · {displayedArticleCount} artikler
            </span>
            {isHot && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-destructive">
                <Flame className="h-3.5 w-3.5" />Hot
              </span>
            )}
            {lastUpdatedRel && (
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Oppdatert {lastUpdatedRel}
              </span>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mt-1 mb-5 leading-[1.02] tracking-[-0.02em]">
            {topic.name}
          </h1>
          {topic.description && (
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-8">{topic.description}</p>
          )}
          {entities.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {entities.slice(0, 6).map((e) => (
                <span key={e.id} className="text-[11px] font-semibold px-2.5 py-1 border border-border" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {e.name}
                  <span className="ml-1.5 text-muted-foreground uppercase tracking-wider">{e.type}</span>
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Featured */}
        {hero && (
          <Link to={`/${hero.slug}`} className="block group mb-14 rounded-[4px] border border-border bg-card p-4 md:p-5 shadow-sm">
            <div className="grid md:grid-cols-12 gap-6 md:gap-8">
              <div className="md:col-span-7 aspect-[16/9] overflow-hidden rounded-[4px] bg-muted">
                <img
                  src={hero.image_url || getCategoryFallbackImage(hero.category, 0)}
                  alt={hero.title}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  loading="eager"
                />
              </div>
              <div className="md:col-span-5 flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Anbefalt · {hero.category}
                </span>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold mb-3 leading-tight group-hover:underline decoration-1 underline-offset-4">
                  {hero.title}
                </h2>
                {hero.meta_description && (
                  <p className="text-muted-foreground text-base leading-relaxed line-clamp-4">{hero.meta_description}</p>
                )}
                <time className="text-[11px] uppercase tracking-wider text-muted-foreground mt-3" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {formatOsloDate(hero.created_at, "d. MMMM yyyy")}
                </time>
              </div>
            </div>
          </Link>
        )}

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12">
          <div className="lg:col-span-8 space-y-14">
            {latest.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-5 pb-3 border-b-2 border-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Siste nytt om {topic.name}
                </h3>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-8">
                  {latest.map((a) => <ArticleCard key={a.id} article={a as any} />)}
                </div>
              </section>
            )}

            {mostRelevant.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-5 pb-3 border-b-2 border-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Mest relevante
                </h3>
                <div className="divide-y divide-border">
                  {mostRelevant.map((a, i) => (
                    <Link key={a.id} to={`/${a.slug}`} className="flex gap-4 py-4 group items-start">
                      <span className="font-serif text-2xl font-bold text-muted-foreground/40 w-8 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      <div className="flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-destructive" style={{ fontFamily: "'Inter', sans-serif" }}>
                          {a.category}
                        </span>
                        <h4 className="text-base md:text-lg font-semibold leading-snug group-hover:underline decoration-1 underline-offset-2 mt-1">
                          {a.title}
                        </h4>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {(explainer || guides.length > 0) && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-5 pb-3 border-b-2 border-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Forklart
                </h3>
                {explainer && (
                  <Link to={`/${explainer.slug}`} className="block group mb-6 pb-6 border-b border-border">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-destructive" style={{ fontFamily: "'Inter', sans-serif" }}>
                      Hovedguide
                    </span>
                    <h4 className="font-serif text-2xl font-bold mt-2 mb-2 leading-tight group-hover:underline decoration-1 underline-offset-4">
                      {explainer.title}
                    </h4>
                    {explainer.meta_description && (
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{explainer.meta_description}</p>
                    )}
                  </Link>
                )}
                {guides.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
                    {guides.map((a) => <ArticleCard key={a.id} article={a as any} size="small" showImage={false} />)}
                  </div>
                )}
              </section>
            )}

            {recommended.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-5 pb-3 border-b-2 border-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Anbefalt lesning
                </h3>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-8">
                  {recommended.map((a) => <ArticleCard key={a.id} article={a as any} size="small" />)}
                </div>
              </section>
            )}
          </div>

          <aside className="lg:col-span-4 space-y-8 lg:sticky lg:top-24 lg:self-start">
            {trending.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-4 pb-3 border-b-2 border-foreground flex items-center gap-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                  <Flame className="h-3.5 w-3.5" />Trender siste uken
                </h3>
                <div className="divide-y divide-border">
                  {trending.map((a, i) => (
                    <Link key={a.id} to={`/${a.slug}`} className="block group py-3.5 first:pt-0">
                      <div className="flex gap-3">
                        <span className="font-serif text-lg font-bold text-muted-foreground/40 w-6 shrink-0">{i + 1}</span>
                        <h4 className="text-[13px] font-semibold line-clamp-2 group-hover:underline decoration-1 underline-offset-2 leading-snug flex-1">{a.title}</h4>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {entities.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-4 pb-3 border-b-2 border-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Aktører i temaet
                </h3>
                <div className="space-y-3">
                  {entities.slice(0, 10).map((e) => (
                    <div key={e.id} className="flex items-baseline justify-between gap-2 pb-2 border-b border-border/60 last:border-0">
                      <span className="text-[13px] font-semibold leading-snug">{e.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0" style={{ fontFamily: "'Inter', sans-serif" }}>
                        {e.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <RelatedTopicsPanel topicId={topic.id} />
          </aside>
        </div>

        <ContextualLinks sourceType="topic" sourceSlug={topic.slug} title="Mer i dette temaet" />
        <DiscoveryFooter />
      </main>


      <NewsFooter />
    </div>
  );
};

export default TopicPage;
