import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SearchAutocomplete } from "./SearchAutocomplete";

const CATEGORIES = [
  { name: "Krypto & Trading", slug: "krypto-trading" },
  { name: "Teknologi & AI", slug: "teknologi-ai" },
  { name: "Finans & Marked", slug: "finans-marked" },
  { name: "Gründer & Startups", slug: "grunder-startups" },
  { name: "Penger & Karriere", slug: "penger-karriere" },
  { name: "Trender & Analyse", slug: "trender-analyse" },
  { name: "Guider & Forklart", slug: "guider-forklart" },
];

const VERTICALS = [
  { name: "AI", to: "/ai" },
  { name: "Krypto", to: "/krypto" },
  { name: "Fintech", to: "/fintech" },
  { name: "Startup", to: "/startup" },
  { name: "Investering", to: "/investering" },
  { name: "Daytrading", to: "/daytrading" },
];

const SECONDARY = [
  { name: "Trending", to: "/trending", accent: true },
  { name: "Academy", to: "/academy" },
  { name: "Verktøy", to: "/tools" },
  { name: "Ressurser", to: "/ressurser" },
  { name: "Brev", to: "/newsletter" },
  { name: "Om oss", to: "/om-oss" },
];

const navItemCls =
  "px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-header-footer-foreground/70 hover:text-header-footer-foreground transition-colors whitespace-nowrap";

export const Navigation = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <nav className="bg-header-footer sticky top-0 z-50 w-full">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Main row */}
        <div className="flex items-center gap-4 h-16 md:h-20">
          <Link to="/" className="flex items-baseline gap-0 shrink-0" aria-label="Marketrends.no forside">
            <span
              className="text-2xl md:text-3xl font-bold tracking-tight text-header-footer-foreground"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: "-0.03em" }}
            >
              Marketrends
            </span>
            <span
              className="text-sm md:text-base font-normal text-header-footer-foreground/50 ml-0.5"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              .no
            </span>
          </Link>

          {/* Desktop search – pushed right */}
          <div className="hidden lg:block ml-auto min-w-0 max-w-xs w-full">
            <SearchAutocomplete />
          </div>

          {/* Mobile / tablet controls */}
          <div className="flex items-center gap-1 ml-auto lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 hover:bg-header-footer-foreground/10 text-header-footer-foreground"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label="Åpne søk"
              aria-expanded={mobileSearchOpen}
            >
              <Search className="h-5 w-5" />
            </Button>
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 hover:bg-header-footer-foreground/10 text-header-footer-foreground"
                  aria-label="Åpne meny"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">
                <SheetHeader className="px-5 py-4 border-b">
                  <SheetTitle className="text-left">Meny</SheetTitle>
                </SheetHeader>

                <div className="px-5 py-4 border-b">
                  <SearchAutocomplete />
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-2">
                  <Accordion type="multiple" defaultValue={["kategorier"]}>
                    <AccordionItem value="kategorier">
                      <AccordionTrigger className="px-3 text-sm font-semibold uppercase tracking-wider">
                        Kategorier
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="flex flex-col">
                          {CATEGORIES.map((cat) => (
                            <li key={cat.slug}>
                              <Link
                                to={`/kategori/${cat.slug}`}
                                onClick={() => setDrawerOpen(false)}
                                className="flex items-center justify-between px-3 min-h-11 py-2 rounded-md text-sm text-foreground hover:bg-muted"
                              >
                                <span>{cat.name}</span>
                                <ChevronRight className="h-4 w-4 opacity-40" />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="temaer">
                      <AccordionTrigger className="px-3 text-sm font-semibold uppercase tracking-wider">
                        Temaer
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="flex flex-col">
                          {VERTICALS.map((v) => (
                            <li key={v.to}>
                              <Link
                                to={v.to}
                                onClick={() => setDrawerOpen(false)}
                                className="flex items-center justify-between px-3 min-h-11 py-2 rounded-md text-sm text-foreground hover:bg-muted"
                              >
                                <span>{v.name}</span>
                                <ChevronRight className="h-4 w-4 opacity-40" />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="mer">
                      <AccordionTrigger className="px-3 text-sm font-semibold uppercase tracking-wider">
                        Mer
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="flex flex-col">
                          {SECONDARY.map((s) => (
                            <li key={s.to}>
                              <Link
                                to={s.to}
                                onClick={() => setDrawerOpen(false)}
                                className={`flex items-center justify-between px-3 min-h-11 py-2 rounded-md text-sm hover:bg-muted ${
                                  s.accent ? "text-destructive font-semibold" : "text-foreground"
                                }`}
                              >
                                <span>{s.name}</span>
                                <ChevronRight className="h-4 w-4 opacity-40" />
                              </Link>
                            </li>
                          ))}
                          <li>
                            <Link
                              to="/dashboard"
                              onClick={() => setDrawerOpen(false)}
                              className="flex items-center justify-between px-3 min-h-11 py-2 rounded-md text-sm text-foreground hover:bg-muted"
                            >
                              <span>Dashboard</span>
                              <ChevronRight className="h-4 w-4 opacity-40" />
                            </Link>
                          </li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Mobile swipeable verticals */}
        <div className="lg:hidden flex items-center -mx-4 px-2 border-t border-header-footer-foreground/15 overflow-x-auto scrollbar-hide">
          {VERTICALS.map((v) => (
            <Link key={v.to} to={v.to} className={navItemCls} style={{ fontFamily: "'Inter', sans-serif" }}>
              {v.name}
            </Link>
          ))}
          <Link to="/trending" className={navItemCls} style={{ fontFamily: "'Inter', sans-serif" }}>
            Trending
          </Link>
        </div>

        {/* Mobile search */}
        {mobileSearchOpen && (
          <div className="lg:hidden pb-4">
            <SearchAutocomplete />
          </div>
        )}

        {/* Desktop category bar – with graceful overflow */}
        <div className="hidden lg:flex items-center gap-0 border-t border-header-footer-foreground/15 -mx-1 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              to={`/kategori/${cat.slug}`}
              className={navItemCls}
              style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "0.08em" }}
            >
              {cat.name}
            </Link>
          ))}
          <div className="ml-auto flex items-center">
            {SECONDARY.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className={`${navItemCls} ${s.accent ? "text-destructive hover:text-destructive" : ""} flex items-center gap-1.5`}
                style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "0.08em" }}
              >
                {s.accent && (
                  <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive" />
                  </span>
                )}
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};
