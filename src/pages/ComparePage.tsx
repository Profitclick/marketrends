import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { NewsFooter } from "@/components/NewsFooter";
import { SEOHead } from "@/components/SEOHead";
import { ArticleContent } from "@/components/ArticleContent";
import { Home, ChevronRight, Check, X } from "lucide-react";

const BASE = "https://marketrends.no";

export default function ComparePage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    supabase.from("comparison_pages").select("*").eq("slug", slug).maybeSingle()
      .then(({ data }) => { setPage(data); setLoading(false); });
  }, [slug]);

  if (loading) return <div className="min-h-dvh bg-background"><Navigation /><div className="max-w-3xl mx-auto p-10 text-muted-foreground">Laster…</div></div>;
  if (!page) return <div className="min-h-dvh bg-background"><Navigation /><div className="max-w-3xl mx-auto p-10">Siden finnes ikke.</div></div>;

  const url = `${BASE}/compare/${page.slug}`;
  const pc = page.pros_cons_json || {};
  const faqs: { q: string; a: string }[] = page.faq_json || [];

  const Col = ({ name, pros, cons }: { name: string; pros: string[]; cons: string[] }) => (
    <div>
      <h3 className="text-xl font-bold mb-4 border-b-2 border-foreground pb-2">{name}</h3>
      <div className="space-y-3">
        {(pros || []).map((p, i) => (
          <div key={`p${i}`} className="flex gap-2 text-sm"><Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" /><span>{p}</span></div>
        ))}
        {(cons || []).map((c, i) => (
          <div key={`c${i}`} className="flex gap-2 text-sm"><X className="h-4 w-4 text-destructive mt-0.5 shrink-0" /><span>{c}</span></div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title={page.meta_title || page.title}
        description={page.meta_description || page.summary || page.title}
        canonicalUrl={url}
        ogType="article"
        breadcrumbs={[{ name: "Hjem", url: BASE }, { name: "Sammenligninger", url: `${BASE}/compare` }, { name: page.title, url }]}
        faqSchema={page.schema_json}
      />
      <Navigation />
      <main className="max-w-[1200px] mx-auto px-4 py-10">
        <div className="max-w-3xl">
          <nav className="flex items-center gap-2 text-[12px] text-muted-foreground mb-6" style={{ fontFamily: "'Inter', sans-serif" }}>
            <Link to="/" className="hover:text-foreground flex items-center gap-1"><Home className="h-3.5 w-3.5" />Hjem</Link>
            <ChevronRight className="h-3 w-3" /><span>Sammenligning</span>
          </nav>
          <span className="text-[11px] font-bold uppercase tracking-widest text-destructive mb-3 block" style={{ fontFamily: "'Inter', sans-serif" }}>
            Faglig sammenligning
          </span>
          <h1 className="text-3xl md:text-5xl font-bold mb-5 leading-[1.1] tracking-tight">{page.title}</h1>
          {page.summary && <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">{page.summary}</p>}

          <div className="grid md:grid-cols-2 gap-8 my-10 py-8 border-y-2 border-foreground">
            <Col name={page.entity_a} pros={pc.a_pros || []} cons={pc.a_cons || []} />
            <Col name={page.entity_b} pros={pc.b_pros || []} cons={pc.b_cons || []} />
          </div>

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
        </div>
      </main>
      <NewsFooter />
    </div>
  );
}
