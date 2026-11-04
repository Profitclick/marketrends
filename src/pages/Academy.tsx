import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { NewsFooter } from "@/components/NewsFooter";
import { SEOHead } from "@/components/SEOHead";
import { BookOpen, Clock, Gauge } from "lucide-react";

const BASE = "https://marketrends.no";

export default function Academy() {
  const [guides, setGuides] = useState<any[]>([]);
  const [knowledge, setKnowledge] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("guides").select("slug,title,summary,category,difficulty,estimated_read_time")
      .eq("published", true).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setGuides(data || []));
    supabase.from("knowledge_pages").select("slug,title,summary,category")
      .eq("published", true).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setKnowledge(data || []));
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title="Markettrends Academy – Lær finans, AI og entreprenørskap"
        description="Norsk læringshub for finans, AI, SaaS, krypto og entreprenørskap. Strukturerte guider og kunnskapssider basert på dagsaktuelle nyheter."
        canonicalUrl={`${BASE}/academy`}
        breadcrumbs={[{ name: "Hjem", url: BASE }, { name: "Academy", url: `${BASE}/academy` }]}
      />
      <Navigation />
      <main className="max-w-[1200px] mx-auto px-4 py-10">
        <header className="mb-12 max-w-2xl">
          <span className="text-[11px] font-bold uppercase tracking-widest text-destructive mb-3 block" style={{ fontFamily: "'Inter', sans-serif" }}>Markettrends Academy</span>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">Lær finans, AI og entreprenørskap</h1>
          <p className="text-lg text-muted-foreground">Strukturerte guider og kunnskapssider for norske lesere – fra grunnleggende til avansert.</p>
        </header>

        <section className="mb-16">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-destructive mb-6 border-b-2 border-foreground pb-2" style={{ fontFamily: "'Inter', sans-serif" }}>Guider</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {guides.map((g) => (
              <Link key={g.slug} to={`/guide/${g.slug}`} className="group block border-t-2 border-foreground pt-4 hover:opacity-80 transition">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-3" style={{ fontFamily: "'Inter', sans-serif" }}>
                  <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{g.category}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{g.estimated_read_time} min</span>
                  <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{g.difficulty}</span>
                </div>
                <h3 className="text-lg font-bold leading-tight mb-2 group-hover:underline">{g.title}</h3>
                {g.summary && <p className="text-sm text-muted-foreground line-clamp-3">{g.summary}</p>}
              </Link>
            ))}
            {!guides.length && <p className="text-muted-foreground col-span-full">Ingen guider er publisert ennå.</p>}
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-destructive mb-6 border-b-2 border-foreground pb-2" style={{ fontFamily: "'Inter', sans-serif" }}>Kunnskapssider</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {knowledge.map((k) => (
              <Link key={k.slug} to={`/knowledge/${k.slug}`} className="group block border-t-2 border-foreground pt-4 hover:opacity-80 transition">
                {k.category && <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>{k.category}</div>}
                <h3 className="text-lg font-bold leading-tight mb-2 group-hover:underline">{k.title}</h3>
                {k.summary && <p className="text-sm text-muted-foreground line-clamp-3">{k.summary}</p>}
              </Link>
            ))}
            {!knowledge.length && <p className="text-muted-foreground col-span-full">Ingen kunnskapssider er publisert ennå.</p>}
          </div>
        </section>
      </main>
      <NewsFooter />
    </div>
  );
}
