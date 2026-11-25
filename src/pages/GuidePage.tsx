import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { loadGuideRouteData, type GuideRoutePage } from "@/lib/routeData";
import { guideMetadata } from "@/lib/routeMetadata";
import { Navigation } from "@/components/Navigation";
import { NewsFooter } from "@/components/NewsFooter";
import { SEOHead } from "@/components/SEOHead";
import { ArticleContent } from "@/components/ArticleContent";
import { DiscoveryFooter } from "@/components/DiscoveryFooter";
import { ContextualLinks } from "@/components/ContextualLinks";
import { Home, ChevronRight, Clock, Gauge } from "lucide-react";

export default function GuidePage({ initialData }: { initialData?: GuideRoutePage } = {}) {
  const { slug } = useParams<{ slug: string }>();
  const [loadedPage, setPage] = useState<GuideRoutePage | null>(null);
  const page = initialData ?? loadedPage;
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    setLoading(true);
    setPage(null);

    loadGuideRouteData(supabase, slug)
      .then((result) => {
        if (!cancelled) setPage(result.status === "found" ? result.data : null);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Error loading guide route:", error);
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

  const steps = Array.isArray(page.steps_json) ? page.steps_json as { title: string; description: string }[] : [];
  const faqs = Array.isArray(page.faq_json) ? page.faq_json as { q: string; a: string }[] : [];
  const resources = Array.isArray(page.resources_json) ? page.resources_json as { title: string; note?: string }[] : [];
  const seo = guideMetadata(page);

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead {...seo} />
      <Navigation />
      <main className="max-w-[1200px] mx-auto px-4 py-10">
        <div className="max-w-3xl">
          <nav className="flex items-center gap-2 text-[12px] text-muted-foreground mb-6" style={{ fontFamily: "'Inter', sans-serif" }}>
            <Link to="/" className="hover:text-foreground flex items-center gap-1"><Home className="h-3.5 w-3.5" />Hjem</Link>
            <ChevronRight className="h-3 w-3" /><span>Guide</span>
          </nav>
          <span className="text-[11px] font-bold uppercase tracking-widest text-destructive mb-3 block" style={{ fontFamily: "'Inter', sans-serif" }}>
            Guide · {page.category}
          </span>
          <h1 className="text-3xl md:text-5xl font-bold mb-5 leading-[1.1] tracking-tight">{page.title}</h1>
          {page.summary && <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">{page.summary}</p>}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8" style={{ fontFamily: "'Inter', sans-serif" }}>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{page.estimated_read_time} min</span>
            <span className="flex items-center gap-1"><Gauge className="h-4 w-4" />{page.difficulty}</span>
          </div>

          {steps.length > 0 && (
            <section className="my-10 border-y-2 border-foreground py-8">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-destructive mb-6" style={{ fontFamily: "'Inter', sans-serif" }}>Steg for steg</h2>
              <ol className="space-y-6">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="text-3xl font-bold text-destructive shrink-0 w-10">{i + 1}</span>
                    <div>
                      <h3 className="text-lg font-semibold mb-1">{s.title}</h3>
                      <p className="text-foreground/80 leading-relaxed">{s.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {page.content && <div className="my-10"><ArticleContent content={page.content} /></div>}

          {resources.length > 0 && (
            <section className="border-t border-border pt-8 mt-10">
              <h2 className="text-xl font-bold mb-4">Ressurser</h2>
              <ul className="space-y-2">
                {resources.map((r, i) => (
                  <li key={i} className="text-sm"><strong>{r.title}</strong>{r.note ? ` — ${r.note}` : ""}</li>
                ))}
              </ul>
            </section>
          )}

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

          {page?.slug && <ContextualLinks sourceType="guide" sourceSlug={page.slug} title="Relatert lesning" />}
          <DiscoveryFooter />
        </div>
      </main>
      <NewsFooter />
    </div>
  );
}
