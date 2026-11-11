import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEOHead";
import { Navigation } from "@/components/Navigation";
import { NewsFooter } from "@/components/NewsFooter";
import { EntityTimeline } from "@/components/EntityTimeline";
import { RelatedEntities } from "@/components/RelatedEntities";
import { DiscoveryFooter } from "@/components/DiscoveryFooter";
import { ContextualLinks } from "@/components/ContextualLinks";
import { TrendingUp, Activity, Clock } from "lucide-react";
import { relativeTimeNo } from "@/lib/freshness";

interface Entity {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  summary: string | null;
  key_facts: any;
  faqs: any;
  what_happened: string | null;
  why_it_matters: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  aliases: string[];
  mention_count: number;
  mentions_last_24h: number;
  mentions_last_7d: number;
  mentions_last_30d: number;
  momentum_score: number;
  trending_score: number;
  last_mention_at: string | null;
  wikidata_id: string | null;
}

const typeLabel: Record<string, string> = {
  company: "Selskap", person: "Person", product: "Produkt",
  location: "Sted", organization: "Organisasjon", technology: "Teknologi",
  cryptocurrency: "Kryptovaluta", asset: "Eiendel", government: "Myndighet",
};

const schemaType: Record<string, string> = {
  person: "Person",
  company: "Organization",
  organization: "Organization",
  government: "GovernmentOrganization",
  product: "Product",
  location: "Place",
  technology: "Thing",
  cryptocurrency: "Thing",
  asset: "Thing",
};

const SITE_URL = "https://marketrends.no";

const TopicPageInner = ({ slug }: { slug: string }) => {
  const [entity, setEntity] = useState<Entity | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("entities")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (!data) setNotFound(true);
      else setEntity(data as any);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (notFound) {
    return (
      <div className="min-h-dvh bg-background">
        <Navigation />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-3">Aktør ikke funnet</h1>
          <p className="text-muted-foreground">
            Vi har ingen profil for denne aktøren ennå. <Link to="/" className="underline">Til forsiden</Link>
          </p>
        </div>
        <NewsFooter />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="min-h-dvh bg-background">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 py-12 animate-pulse">
          <div className="h-8 w-48 bg-muted mb-4" />
          <div className="h-12 w-2/3 bg-muted mb-3" />
          <div className="h-4 w-full bg-muted mb-2" />
          <div className="h-4 w-3/4 bg-muted" />
        </div>
      </div>
    );
  }

  const canonical = `${SITE_URL}/entity/${entity.slug}`;
  const title = entity.meta_title || `${entity.name} – Nyheter, analyse og kontekst`;
  const description =
    entity.meta_description ||
    entity.summary ||
    entity.description ||
    `Følg ${entity.name} på Marketrends. Nyheter, analyse og redaksjonell kontekst om ${entity.name}.`;

  const facts: string[] = Array.isArray(entity.key_facts) ? entity.key_facts : [];
  const faqs: { q: string; a: string }[] = Array.isArray(entity.faqs) ? entity.faqs : [];

  // JSON-LD
  const entityJsonLd = {
    "@context": "https://schema.org",
    "@type": schemaType[entity.type] || "Thing",
    name: entity.name,
    alternateName: entity.aliases || [],
    description,
    url: canonical,
    ...(entity.wikidata_id && { sameAs: [`https://www.wikidata.org/wiki/${entity.wikidata_id}`] }),
    ...(entity.og_image && { image: entity.og_image }),
  };

  const faqJsonLd = faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title={title}
        description={description}
        canonicalUrl={canonical}
        ogImage={entity.og_image || undefined}
        ogType="website"
        breadcrumbs={[
          { name: "Forsiden", url: SITE_URL },
          { name: "Aktører", url: `${SITE_URL}/entity` },
          { name: entity.name, url: canonical },
        ]}
        faqSchema={faqJsonLd || undefined}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(entityJsonLd)}</script>
      </Helmet>

      <Navigation />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Header */}
        <header className="border-b border-border pb-8 mb-10">
          <div
            className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-3"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            <Link to="/" className="hover:underline">Forsiden</Link>
            <span>›</span>
            <span>Aktør</span>
            <span>›</span>
            <span>{typeLabel[entity.type] || entity.type}</span>
          </div>
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.03] tracking-[-0.02em] mb-4"
            style={{ fontFamily: "'Source Serif 4', serif" }}
          >
            {entity.name}
          </h1>
          {entity.summary && (
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-8">
              {entity.summary}
            </p>
          )}
          {/* Quick stats */}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs uppercase tracking-wider text-muted-foreground"
            style={{ fontFamily: "'Inter', sans-serif" }}>
            <span className="flex items-center gap-1.5">
              <Activity className="h-3 w-3" /> {entity.mention_count} omtaler totalt
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" /> {entity.mentions_last_7d} siste 7 dager
            </span>
            {entity.last_mention_at && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Sist omtalt {relativeTimeNo(entity.last_mention_at)}
              </span>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
          {/* Main */}
          <div className="lg:col-span-8 space-y-12">
            {(entity.what_happened || entity.why_it_matters) && (
              <section className="grid sm:grid-cols-2 gap-6 rounded-sm border border-border p-5 md:p-6 bg-card shadow-sm">
                {entity.what_happened && (
                  <div>
                    <h2 className="text-[11px] font-bold uppercase tracking-widest mb-2"
                      style={{ fontFamily: "'Inter', sans-serif" }}>
                      Hva har skjedd?
                    </h2>
                    <p className="text-sm leading-relaxed">{entity.what_happened}</p>
                  </div>
                )}
                {entity.why_it_matters && (
                  <div>
                    <h2 className="text-[11px] font-bold uppercase tracking-widest mb-2"
                      style={{ fontFamily: "'Inter', sans-serif" }}>
                      Hvorfor det betyr noe
                    </h2>
                    <p className="text-sm leading-relaxed">{entity.why_it_matters}</p>
                  </div>
                )}
              </section>
            )}

            {facts.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest mb-4 pb-3 border-b-2 border-foreground"
                  style={{ fontFamily: "'Inter', sans-serif" }}>
                  Nøkkelfakta
                </h2>
                <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  {facts.map((f, i) => (
                    <li key={i} className="border-l-2 border-foreground pl-3 py-1">{f}</li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-4 pb-3 border-b-2 border-foreground"
                style={{ fontFamily: "'Inter', sans-serif" }}>
                Siste utvikling
              </h2>
              <EntityTimeline entityId={entity.id} />
            </section>

            {faqs.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest mb-4 pb-3 border-b-2 border-foreground"
                  style={{ fontFamily: "'Inter', sans-serif" }}>
                  Ofte stilte spørsmål
                </h2>
                <div className="space-y-4">
                  {faqs.map((f, i) => (
                    <details key={i} className="border-b border-border pb-3">
                      <summary className="cursor-pointer font-semibold text-[15px] leading-snug">
                        {f.q}
                      </summary>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-8 lg:sticky lg:top-24 lg:self-start">
            <RelatedEntities entityId={entity.id} />
            {entity.aliases?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-3 pb-2 border-b-2 border-foreground"
                  style={{ fontFamily: "'Inter', sans-serif" }}>
                  Også kjent som
                </h3>
                <p className="text-sm text-muted-foreground">{entity.aliases.join(", ")}</p>
              </div>
            )}
          </aside>
        </div>

        <ContextualLinks sourceType="entity" sourceSlug={entity.slug} title="Mer rundt denne aktøren" />
        <DiscoveryFooter />
      </main>


      <NewsFooter />
    </div>
  );
};

const EntityPage = () => {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return null;
  return <TopicPageInner slug={slug} />;
};

export default EntityPage;
