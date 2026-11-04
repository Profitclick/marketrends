import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { NewsFooter } from "@/components/NewsFooter";
import { Database, FileText, Library, BarChart3, Landmark, Briefcase } from "lucide-react";

const SECTIONS = [
  { key: "research", title: "Forskningsrapporter", icon: FileText, desc: "Redaksjonelle dybderapporter på norske markedsforhold." },
  { key: "datasets", title: "Datasett", icon: Database, desc: "Strukturerte, åpne datasett brukt i vår dekning." },
  { key: "sources", title: "Offentlige kilder", icon: Library, desc: "Kildebibliotek med primær- og sekundærkilder." },
  { key: "statistics", title: "Statistikk", icon: BarChart3, desc: "Tall, indekser og makro-statistikk." },
  { key: "government", title: "Myndighetsdata", icon: Landmark, desc: "SSB, Norges Bank, Brønnøysund, Finanstilsynet." },
  { key: "industry", title: "Bransjerapporter", icon: Briefcase, desc: "Rapporter fra industri og bransjeorganisasjoner." },
];

const Resources = () => {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const sb = supabase as any;
      const [r, d, s] = await Promise.all([
        sb.from("research_reports").select("*", { count: "exact", head: true }),
        sb.from("datasets").select("*", { count: "exact", head: true }),
        sb.from("source_library").select("*", { count: "exact", head: true }),
      ]);
      setCounts({
        research: r.count || 0,
        datasets: d.count || 0,
        sources: s.count || 0,
      });
    })();
  }, []);

  return (
    <>
      <Helmet>
        <title>Ressurssenter – data, kilder og rapporter | Marketrends</title>
        <meta name="description" content="Marketrends sitt åpne ressursbibliotek: forskningsrapporter, datasett, statistikk og offentlige kilder for norske markeder." />
        <link rel="canonical" href="https://marketrends.no/ressurser" />
      </Helmet>
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-10">
        <header className="border-b border-border pb-6 mb-10">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Ressurssenter</span>
          <h1 className="font-serif text-4xl md:text-5xl mt-2 mb-3">Ressurser, data og kilder</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Et åpent bibliotek av kilder, datasett og rapporter som ligger til grunn for Marketrends sin dekning.
          </p>
        </header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const count = counts[s.key];
            return (
              <Link key={s.key} to={`/ressurser/${s.key}`} className="border border-border p-5 hover:bg-muted transition">
                <Icon className="h-6 w-6 mb-3 text-foreground" />
                <h2 className="font-serif text-xl mb-1">{s.title}</h2>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
                {typeof count === "number" && <p className="text-xs mt-2">{count} oppføringer</p>}
              </Link>
            );
          })}
        </div>
      </main>
      <NewsFooter />
    </>
  );
};

export default Resources;
