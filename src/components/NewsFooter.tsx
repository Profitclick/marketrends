import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORIES = [
  { name: "Finans & Marked", slug: "finans-marked" },
  { name: "Teknologi & AI", slug: "teknologi-ai" },
  { name: "Krypto & Trading", slug: "krypto-trading" },
  { name: "Gründer & Startups", slug: "grunder-startups" },
  { name: "Penger & Karriere", slug: "penger-karriere" },
  { name: "Trender & Analyse", slug: "trender-analyse" },
  { name: "Guider & Forklart", slug: "guider-forklart" },
];

const RESOURCES = [
  { name: "Academy", to: "/academy" },
  { name: "Verktøy", to: "/tools" },
  { name: "Ressurser", to: "/ressurser" },
  { name: "Trending", to: "/trending" },
];

export const NewsFooter = () => (
  <footer className="bg-header-footer mt-20">
    <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div className="grid gap-10 md:grid-cols-12">
        {/* Brand + newsletter */}
        <div className="md:col-span-5">
          <Link to="/" className="flex items-baseline gap-0 mb-5" aria-label="Marketrends.no forside">
            <span
              className="text-xl font-bold tracking-tight text-header-footer-foreground"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: "-0.03em" }}
            >
              Marketrends
            </span>
            <span
              className="text-sm font-normal text-header-footer-foreground/50 ml-0.5"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              .no
            </span>
          </Link>
          <p className="text-sm text-header-footer-foreground/60 mb-6 max-w-md leading-relaxed">
            Norges ledende kilde for finans, teknologi, krypto og markedsnyheter.
            Oppdatert døgnet rundt.
          </p>

          <form
            action="/newsletter"
            method="get"
            className="flex flex-col sm:flex-row gap-2 max-w-md"
            aria-label="Meld deg på nyhetsbrev"
          >
            <label htmlFor="footer-newsletter-email" className="sr-only">E-postadresse</label>
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-header-footer-foreground/50" aria-hidden="true" />
              <Input
                id="footer-newsletter-email"
                type="email"
                name="email"
                placeholder="din@epost.no"
                className="pl-9 bg-header-footer-foreground/10 border-header-footer-foreground/15 text-header-footer-foreground placeholder:text-header-footer-foreground/40 min-h-11"
              />
            </div>
            <Button type="submit" variant="secondary" className="min-h-11 shrink-0">
              Abonner
            </Button>
          </form>
        </div>

        {/* Kategorier */}
        <nav className="md:col-span-3" aria-label="Kategorier">
          <h3
            className="text-[11px] font-bold uppercase tracking-widest text-header-footer-foreground/70 mb-4"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Kategorier
          </h3>
          <ul className="space-y-2 text-sm text-header-footer-foreground/60">
            {CATEGORIES.map((cat) => (
              <li key={cat.slug}>
                <Link to={`/kategori/${cat.slug}`} className="hover:text-header-footer-foreground transition-colors">
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Ressurser */}
        <nav className="md:col-span-2" aria-label="Ressurser">
          <h3
            className="text-[11px] font-bold uppercase tracking-widest text-header-footer-foreground/70 mb-4"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Ressurser
          </h3>
          <ul className="space-y-2 text-sm text-header-footer-foreground/60">
            {RESOURCES.map((r) => (
              <li key={r.to}>
                <Link to={r.to} className="hover:text-header-footer-foreground transition-colors">
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Redaksjonen */}
        <nav className="md:col-span-2" aria-label="Redaksjonen">
          <h3
            className="text-[11px] font-bold uppercase tracking-widest text-header-footer-foreground/70 mb-4"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Redaksjonen
          </h3>
          <ul className="space-y-2 text-sm text-header-footer-foreground/60">
            <li>
              <Link to="/om-oss" className="hover:text-header-footer-foreground transition-colors">
                Om oss
              </Link>
            </li>
            <li>
              <a href="mailto:redaksjon@marketrends.no" className="hover:text-header-footer-foreground transition-colors break-all">
                redaksjon@marketrends.no
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="mt-10 pt-6 border-t border-header-footer-foreground/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-xs text-header-footer-foreground/40">
          © {new Date().getFullYear()} Marketrends.no. Alle rettigheter reservert.
        </p>
        <p className="text-[11px] text-header-footer-foreground/40">
          Innhold levert i samarbeid med ledende internasjonale kilder · AI-assistert lokalisering
        </p>
      </div>
    </div>
  </footer>
);
