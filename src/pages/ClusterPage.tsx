import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { SEOHead } from "@/components/SEOHead";
import { NewsFooter } from "@/components/NewsFooter";
import { ArticleCard } from "@/components/ArticleCard";
import { DiscoveryFooter } from "@/components/DiscoveryFooter";
import { AuthorityBadge } from "@/components/AuthorityBadge";
import { ContextualLinks } from "@/components/ContextualLinks";
import { getCluster, CLUSTERS } from "@/config/clusters";
import { loadClusterRouteData, type ClusterRouteData } from "@/lib/routeData";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-border pt-8 mt-12">
    <h2 className="font-serif text-2xl md:text-3xl tracking-[-0.01em] mb-6">{title}</h2>
    {children}
  </section>
);

const ClusterPage = ({ overrideSlug, initialData }: { overrideSlug?: string; initialData?: ClusterRouteData } = {}) => {
  const params = useParams<{ slug: string }>();
  const slug = overrideSlug || params.slug;
  const cluster = slug ? getCluster(slug) : null;
  const [loadedData, setLoadedData] = useState<ClusterRouteData | null>(null);
  const data = initialData ?? loadedData;
  const stats = data?.stats ?? null;
  const articles = data?.articles ?? [];
  const topics = data?.topics ?? [];
  const entities = data?.entities ?? [];
  const guides = data?.guides ?? [];
  const knowledge = data?.knowledge ?? [];
  const comparisons = data?.comparisons ?? [];
  const opps: { id: string; keyword: string; recommended_content_type: string; opportunity_score: number }[] = [];

  useEffect(() => {
    if (initialData || !slug) return;
    let cancelled = false;
    loadClusterRouteData(supabase, slug).then((result) => {
      if (!cancelled && result.status === "found") setLoadedData(result.data);
    }).catch((error) => console.error("Error loading cluster route:", error));
    return () => { cancelled = true; };
  }, [slug, initialData]);

  if (!cluster) {
    return (
      <div>
        <Navigation />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="font-serif text-3xl mb-2">Cluster ikke funnet</h1>
          <Link to="/" className="underline">Til forsiden</Link>
        </div>
      </div>
    );
  }

  const title = `${cluster.name} – tema, analyse og guider | Marketrends`;
  const desc = cluster.intro;

  return (
    <>
      <SEOHead
        title={title}
        description={desc}
        canonicalUrl={`https://marketrends.no/${cluster.slug}`}
        ogType="website"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: cluster.name,
          description: desc,
          url: `https://marketrends.no/${cluster.slug}`,
        })}</script>
      </Helmet>
      <Navigation />
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <header className="border-b border-border pb-9 mb-2">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Cluster</span>
            {stats && <AuthorityBadge score={stats.authority_score || 0} />}
          </div>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.03] tracking-[-0.02em] mb-4">{cluster.name}</h1>
          <p className="text-lg md:text-xl leading-8 text-muted-foreground max-w-3xl">{cluster.intro}</p>
        </header>

        <Section title="Siste nyheter">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-7">
            {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        </Section>

        <div className="grid md:grid-cols-2 gap-10 lg:gap-12 mt-12">
          <Section title="Trendende tema">
            <ul className="space-y-2">
              {topics.map((t) => (
                <li key={t.id} className="flex items-center justify-between border-b border-border/60 pb-2">
                  <Link to={`/topic/${t.slug}`} className="font-medium hover:underline">{t.name}</Link>
                  <AuthorityBadge score={t.authority_score || 0} label="A" />
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Trendende entiteter">
            <ul className="space-y-2">
              {entities.map((e) => (
                <li key={e.id} className="flex items-center justify-between border-b border-border/60 pb-2">
                  <Link to={`/entity/${e.slug}`} className="font-medium hover:underline">{e.name}</Link>
                  <AuthorityBadge score={e.authority_score || 0} label="A" />
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-10 mt-12">
          {[
            { title: "Guider", items: guides, base: "/guide/" },
            { title: "Knowledge", items: knowledge, base: "/knowledge/" },
            { title: "Sammenligninger", items: comparisons, base: "/compare/" },
          ].map(({ title, items, base }) => (
            <div key={title} className="border-t border-border pt-6">
              <h3 className="font-serif text-xl mb-3">{title}</h3>
              <ul className="space-y-2">
                {items.length === 0 && <li className="text-sm text-muted-foreground">Ingen ennå.</li>}
                {items.map((i: any) => (
                  <li key={i.slug}><Link to={`${base}${i.slug}`} className="hover:underline">{i.title}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Section title="Ofte stilte spørsmål">
          <div className="space-y-4 max-w-3xl">
            {cluster.faq.map((f, i) => (
              <details key={i} className="border-b border-border pb-3">
                <summary className="font-medium cursor-pointer">{f.q}</summary>
                <p className="mt-2 text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        {opps.length > 0 && (
          <Section title="Mulighetsindikatorer">
            <ul className="space-y-2 max-w-3xl">
              {opps.map((o) => (
                <li key={o.id} className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span>{o.keyword}</span>
                  <span className="text-xs text-muted-foreground">{o.recommended_content_type} · {Math.round(o.opportunity_score)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Relaterte clustere">
          <div className="flex flex-wrap gap-3">
            {cluster.related.map((r) => {
              const c = CLUSTERS.find((x) => x.slug === r);
              if (!c) return null;
              return (
                <Link key={r} to={`/${r}`} className="border border-border px-3 py-1.5 text-sm hover:bg-muted">
                  {c.name}
                </Link>
              );
            })}
          </div>
        </Section>

        <ContextualLinks sourceType="cluster" sourceSlug={cluster.slug} title="Hele klyngen" />
        <DiscoveryFooter />
      </main>
      <NewsFooter />
    </>
  );
};

export default ClusterPage;
