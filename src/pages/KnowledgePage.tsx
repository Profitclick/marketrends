import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { loadKnowledgeRouteData, type KnowledgeRoutePage } from "@/lib/routeData";
import { knowledgeMetadata } from "@/lib/routeMetadata";
import { Navigation } from "@/components/Navigation";
import { NewsFooter } from "@/components/NewsFooter";
import { SEOHead } from "@/components/SEOHead";
import { ArticleContent } from "@/components/ArticleContent";
import { DiscoveryFooter } from "@/components/DiscoveryFooter";
import { ContextualLinks } from "@/components/ContextualLinks";
import { Home, ChevronRight } from "lucide-react";

export default function KnowledgePage({ initialData }: { initialData?: KnowledgeRoutePage } = {}) {
  const { slug } = useParams<{ slug: string }>();
  const [loadedPage, setPage] = useState<KnowledgeRoutePage | null>(null);
  const page = initialData ?? loadedPage;
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    setLoading(true);
    setPage(null);

    loadKnowledgeRouteData(supabase, slug)
      .then((result) => {
        if (!cancelled) setPage(result.status === "found" ? result.data : null);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Error loading knowledge route:", error);
          setPage(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug, initialData]);

  if (loading) return <div className="min-h-dvh bg-background"><Navigation /><div className="max-w-3xl mx-auto p-10 text-muted-foreground">Laster…</div></div>;
  if (!page) return <div className="min-h-dvh bg-background"><Navigation /><div className="max-w-3xl mx-auto p-10">Siden finnes ikke.</div></div>;

  const takeaways = Array.isArray(page.key_takeaways_json) ? page.key_takeaways_json.filter((x): x is string => typeof x === "string") : [];
  const faqs = Array.isArray(page.faq_json) ? page.faq_json as { q: string; a: string }[] : [];
  const seo = knowledgeMetadata(page);

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead {...seo} />
      <Navigation />
      <main className="max-w-[1200px] mx-auto px-4 py-10">
        <div className="max-w-3xl">
          <nav className="flex items-center gap-2 text-[12px] text-muted-foreground mb-6" style={{ fontFamily: "'Inter', sans-serif" }}>
            <Link to="/" className="hover:text-foreground flex items-center gap-1"><Home className="h-3.5 w-3.5" />Hjem</Link>
            <ChevronRight className="h-3 w-3" /><span>Kunnskap</span>
          </nav>
          <span className="text-[11px] font-bold uppercase tracking-widest text-destructive mb-3 block" style={{ fontFamily: "'Inter', sans-serif" }}>
            Kunnskapsside
          </span>
          <h1 className="text-3xl md:text-5xl font-bold mb-5 leading-[1.1] tracking-tight">{page.title}</h1>
          {page.summary && <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">{page.summary}</p>}

          {takeaways.length > 0 && (
            <aside className="my-8 border-y-2 border-foreground py-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>Kort fortalt</div>
              <ul className="space-y-2.5">
                {takeaways.map((t, i) => (
                  <li key={i} className="text-[14px] md:text-[15px] leading-[1.65] text-foreground/85 pl-4 relative">
                    <span className="absolute left-0 top-2 h-1.5 w-1.5 bg-destructive" />{t}
                  </li>
                ))}
              </ul>
            </aside>
          )}

          {page.content && <div className="my-10"><ArticleContent content={page.content} /></div>}

          {faqs.length > 0 && (
            <section className="border-t-2 border-foreground pt-8 mt-12">
              <h2 className="text-2xl font-bold mb-6">Ofte stilte spørsmål</h2>
              <div className="space-y-6">
                {faqs.map((f, i) => (
                  <div key={i}>
                    <h3 className="text-lg font-semibold mb-2">{f.q}</h3>
                    <p className="text-foreground/80 leading-relaxed">{f.a}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {page?.slug && <ContextualLinks sourceType="knowledge" sourceSlug={page.slug} title="Mer å lese" />}
          <DiscoveryFooter />
        </div>
      </main>
      <NewsFooter />
    </div>
  );
}
