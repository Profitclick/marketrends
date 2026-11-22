import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  loadSearchIntentRouteData,
  type SearchIntentRouteIntent,
  type SearchIntentRoutePillar,
} from "@/lib/routeData";
import { INTENT_LABEL, searchIntentMetadata } from "@/lib/routeMetadata";
import { Navigation } from "@/components/Navigation";
import { NewsFooter } from "@/components/NewsFooter";
import { SEOHead } from "@/components/SEOHead";
import { ArticleContent } from "@/components/ArticleContent";
import { DiscoveryFooter } from "@/components/DiscoveryFooter";
import { ContextualLinks } from "@/components/ContextualLinks";
import { GeoBlocks } from "@/components/GeoBlocks";
import { PillarNav } from "@/components/PillarNav";
import { Home, ChevronRight } from "lucide-react";

export default function SearchIntentPage() {
  const { slug } = useParams<{ slug: string }>();
  const [intent, setIntent] = useState<SearchIntentRouteIntent | null>(null);
  const [pillar, setPillar] = useState<SearchIntentRoutePillar | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIntent(null);
    setPillar(null);

    loadSearchIntentRouteData(supabase, slug)
      .then((result) => {
        if (cancelled) return;
        if (result.status === "found") {
          setIntent(result.data.intent);
          setPillar(result.data.pillar);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Error loading search intent route:", error);
          setIntent(null);
          setPillar(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug]);


  if (loading) return <div className="min-h-dvh bg-background"><Navigation /><div className="max-w-3xl mx-auto p-10 text-muted-foreground">Laster…</div></div>;
  if (!intent || intent.content_status !== "published") return <div className="min-h-dvh bg-background"><Navigation /><div className="max-w-3xl mx-auto p-10">Siden finnes ikke.</div></div>;

  const meta = intent.meta || {};
  const geo = intent.geo_blocks || {};
  const title = meta.title || intent.keyword;
  const seo = searchIntentMetadata(intent, pillar);

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead {...seo} />
      <Navigation />
      <main className="max-w-[1200px] mx-auto px-4 py-10">
        <div className="max-w-3xl">
          <nav aria-label="Brødsmulesti" className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground mb-6">
            <Link to="/" className="hover:text-foreground flex items-center gap-1"><Home className="h-3.5 w-3.5" />Hjem</Link>
            <ChevronRight className="h-3 w-3" /><span>{INTENT_LABEL[intent.intent_type] || "Intent"}</span>
            {pillar?.target_slug && (
              <>
                <ChevronRight className="h-3 w-3" />
                <Link to={`/intent/${pillar.target_slug}`} className="hover:text-foreground">{pillar.keyword}</Link>
              </>
            )}
          </nav>
          <span className="text-[11px] font-bold uppercase tracking-widest text-destructive mb-3 block">
            {intent.is_pillar ? "Pilar" : INTENT_LABEL[intent.intent_type] || intent.intent_type}
          </span>
          <h1 className="text-3xl md:text-5xl font-bold mb-5 leading-[1.1] tracking-tight">{title}</h1>
          {meta.summary && <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">{meta.summary}</p>}

          <GeoBlocks data={geo} />

          {meta.content && <div className="my-10"><ArticleContent content={meta.content} /></div>}

          <PillarNav intent={intent} />


          <ContextualLinks sourceType="intent" sourceSlug={intent.target_slug} title="Videre lesning" />
          <DiscoveryFooter />
        </div>
      </main>
      <NewsFooter />
    </div>
  );
}
