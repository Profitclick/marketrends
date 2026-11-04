import { Navigation } from "@/components/Navigation";
import { NewsFooter } from "@/components/NewsFooter";
import { SEOHead } from "@/components/SEOHead";
import { Calculator, Wallet, TrendingUp, Briefcase, Brain, PieChart, Target, Users } from "lucide-react";

const BASE = "https://marketrends.no";

const TOOLS = [
  { icon: Wallet, name: "Krypto-posisjonskalkulator", desc: "Beregn riktig posisjonstørrelse basert på risiko.", status: "Kommer" },
  { icon: TrendingUp, name: "Startup runway-kalkulator", desc: "Hvor lenge holder kassen? Beregn runway og burn.", status: "Kommer" },
  { icon: Calculator, name: "Burn rate-kalkulator", desc: "Månedlig forbrenning av kapital.", status: "Kommer" },
  { icon: Briefcase, name: "SaaS-verdsettelseskalkulator", desc: "ARR × multiple basert på vekst og marginer.", status: "Kommer" },
  { icon: Brain, name: "AI ROI-kalkulator", desc: "Beregn avkastning på AI-investering.", status: "Kommer" },
  { icon: Users, name: "Grunderegenkapital-kalkulator", desc: "Fordel cap table mellom grunnleggere.", status: "Kommer" },
  { icon: PieChart, name: "LTV-kalkulator", desc: "Livstidsverdi per kunde.", status: "Kommer" },
  { icon: Target, name: "CAC-kalkulator", desc: "Kundeanskaffelseskostnad og payback-tid.", status: "Kommer" },
];

export default function Tools() {
  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title="Verktøy – Kalkulatorer for finans, SaaS og startup"
        description="Praktiske norske kalkulatorer for investering, SaaS-verdsettelse, runway, burn rate, AI ROI og mer. Bygget for grunnleggere og investorer."
        canonicalUrl={`${BASE}/tools`}
        breadcrumbs={[{ name: "Hjem", url: BASE }, { name: "Verktøy", url: `${BASE}/tools` }]}
      />
      <Navigation />
      <main className="max-w-[1200px] mx-auto px-4 py-10">
        <header className="mb-12 max-w-2xl">
          <span className="text-[11px] font-bold uppercase tracking-widest text-destructive mb-3 block" style={{ fontFamily: "'Inter', sans-serif" }}>Verktøy</span>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">Kalkulatorer og verktøy</h1>
          <p className="text-lg text-muted-foreground">Praktiske verktøy for investorer, grunnleggere og operatører. Nye verktøy publiseres fortløpende.</p>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOOLS.map(({ icon: Icon, name, desc, status }) => (
            <div key={name} className="border-t-2 border-foreground pt-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className="h-5 w-5 text-destructive" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>{status}</span>
              </div>
              <h3 className="text-lg font-bold leading-tight mb-2">{name}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </main>
      <NewsFooter />
    </div>
  );
}
