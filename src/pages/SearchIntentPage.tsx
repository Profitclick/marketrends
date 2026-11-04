import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { NewsFooter } from "@/components/NewsFooter";
import { SEOHead } from "@/components/SEOHead";
import { ArticleContent } from "@/components/ArticleContent";
import { DiscoveryFooter } from "@/components/DiscoveryFooter";
import { ContextualLinks } from "@/components/ContextualLinks";
import { GeoBlocks } from "@/components/GeoBlocks";
import { PillarNav } from "@/components/PillarNav";
import { Home, ChevronRight } from "lucide-react";

const BASE = "https://marketrends.no";

const INTENT_LABEL: Record<string, string> = {
  informational: "Kunnskap",
  commercial: "Vurdering",
  transactional: "Guide",
  comparison: "Sammenligning",
};

export default function SearchIntentPage() {
  const { slug } = useParams<{ slug: string }>();
  const [intent, setIntent] = useState<any>(null);
  const [pillar, setPillar] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("search_intents").select("*")
        .eq("target_slug", slug).maybeSingle();
      setIntent(data);
      setPillar(null);
      if (data && !data.is_pillar && data.pillar_intent_id) {
        const { data: p } = await supabase.from("search_intents")
          .select("keyword, target_slug, content_status")
          .eq("id", data.pillar_intent_id).maybeSingle();
        if (p?.content_status === "published") setPillar(p);
      }
      setLoading(false);
    })();
  }, [slug]);


  if (loading) return <div className="min-h-dvh bg-background"><Navigation /><div className="max-w-3xl mx-auto p-10 text-muted-foreground">Laster…</div></div>;
  if (!intent || intent.content_status !== "published") return <div className="min-h-dvh bg-background"><Navigation /><div className="max-w-3xl mx-auto p-10">Siden finnes ikke.</div></div>;

  const meta = intent.meta || {};
  const geo = intent.geo_blocks || {};
  const url = `${BASE}/intent/${intent.target_slug}`;
  const title = meta.title || intent.keyword;

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title={meta.meta_title || title}
        description={meta.meta_description || meta.summary || title}
        canonicalUrl={url}
        ogType="article"
        breadcrumbs={[
          { name: "Hjem", url: BASE },
          { name: INTENT_LABEL[intent.intent_type] || "Intent", url: `${BASE}/intent` },
          ...(pillar?.target_slug ? [{ name: pillar.keyword, url: `${BASE}/intent/${pillar.target_slug}` }] : []),
          { name: title, url },
        ]}
        faqSchema={meta.faq_schema}
      />
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
