import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, Search, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchAutocomplete } from "./SearchAutocomplete";

const CATEGORIES = [
  { name: "Krypto & Trading", to: "/kategori/krypto-trading" },
  { name: "Teknologi & AI", to: "/kategori/teknologi-ai" },
  { name: "Finans & Marked", to: "/kategori/finans-marked" },
  { name: "Gründer & Startups", to: "/kategori/grunder-startups" },
  { name: "Penger & Karriere", to: "/kategori/penger-karriere" },
  { name: "Trender & Analyse", to: "/kategori/trender-analyse" },
  { name: "Guider & Forklart", to: "/kategori/guider-forklart" },
];

const PRIMARY = [
  { name: "AI", to: "/ai" },
  { name: "Krypto", to: "/krypto" },
  { name: "Fintech", to: "/fintech" },
  { name: "Investering", to: "/investering" },
];

const MORE_TOPICS = [
  { name: "Startup", to: "/startup" },
  { name: "Daytrading", to: "/daytrading" },
  { name: "Trending", to: "/trending" },
];

const MORE_SERVICES = [
  { name: "Academy", to: "/academy" },
  { name: "Verktøy", to: "/tools" },
  { name: "Ressurser", to: "/ressurser" },
  { name: "Nyhetsbrev", to: "/newsletter" },
  { name: "Om oss", to: "/om-oss" },
];

const navItem =
  "inline-flex items-center gap-1 h-10 px-3 rounded-sm text-[13px] font-semibold tracking-wide text-header-footer-foreground/80 hover:text-header-footer-foreground hover:bg-header-footer-foreground/10 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header-footer-foreground/70";

/** Hover + click + keyboard dropdown built on Radix (Escape / click outside handled by Radix). */
const HoverMenu = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger className={`${navItem} data-[state=open]:text-header-footer-foreground data-[state=open]:bg-header-footer-foreground/10`}>
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={0} className="z-[60] min-w-[15rem] rounded-sm p-1.5">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const MenuLinks = ({ items }: { items: { name: string; to: string }[] }) => (
  <>
    {items.map((i) => (
      <DropdownMenuItem key={i.to} asChild className="cursor-pointer text-sm py-2">
        <Link to={i.to}>{i.name}</Link>
      </DropdownMenuItem>
    ))}
  </>
);

const groupLabel = "text-[11px] uppercase tracking-widest text-muted-foreground font-semibold";

export const Navigation = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const drawerGroup = (title: string, items: { name: string; to: string }[]) => (
    <section className="py-3 border-b last:border-0">
      <h2 className={`px-3 pb-1 ${groupLabel}`}>{title}</h2>
      <ul>
        {items.map((i) => (
          <li key={i.to}>
            <Link
              to={i.to}
              onClick={() => setDrawerOpen(false)}
              className="flex items-center justify-between px-3 min-h-11 rounded-sm text-[15px] text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{i.name}</span>
              <ChevronRight className="h-4 w-4 opacity-40" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <nav aria-label="Hovednavigasjon" className="bg-header-footer sticky top-0 z-50 w-full border-b border-header-footer-foreground/10" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 xl:gap-6 h-16">
          <Link to="/" className="flex items-baseline shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header-footer-foreground/70" aria-label="Marketrends.no forside">
            <span className="text-2xl font-bold text-header-footer-foreground" style={{ fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: "-0.03em" }}>
              Marketrends
            </span>
            <span className="text-sm text-header-footer-foreground/50 ml-0.5">.no</span>
          </Link>

          {/* Desktop primary nav: max 6 items, never scrolls */}
          <ul className="hidden lg:flex items-center gap-0.5 min-w-0">
            <li>
              <HoverMenu label="Nyheter">
                <DropdownMenuItem asChild className="cursor-pointer text-sm py-2 font-semibold">
                  <Link to="/">Alle nyheter</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className={groupLabel}>Kategorier</DropdownMenuLabel>
                <MenuLinks items={CATEGORIES} />
              </HoverMenu>
            </li>
            {PRIMARY.map((p) => (
              <li key={p.to}>
                <NavLink to={p.to} className={({ isActive }) => `${navItem} ${isActive ? "text-header-footer-foreground bg-header-footer-foreground/10" : ""}`}>
                  {p.name}
                </NavLink>
              </li>
            ))}
            <li>
              <HoverMenu label="Mer">
                <DropdownMenuLabel className={groupLabel}>Fagområder</DropdownMenuLabel>
                <MenuLinks items={MORE_TOPICS} />
                <DropdownMenuSeparator />
                <DropdownMenuLabel className={groupLabel}>Tjenester</DropdownMenuLabel>
                <MenuLinks items={MORE_SERVICES} />
              </HoverMenu>
            </li>
          </ul>

          <div className="hidden lg:flex items-center gap-3 ml-auto min-w-0">
            <div className="w-44 xl:w-60 min-w-0">
              <SearchAutocomplete />
            </div>
            <Link
              to="/newsletter"
              className="hidden xl:inline-flex items-center h-9 px-4 rounded-sm bg-header-footer-foreground text-header-footer text-[13px] font-semibold whitespace-nowrap hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-header-footer focus-visible:ring-header-footer-foreground"
            >
              Nyhetsbrev
            </Link>
          </div>

          {/* Mobile / tablet */}
          <div className="flex items-center gap-1 ml-auto lg:hidden">
            <Button variant="ghost" size="icon" className="h-11 w-11 hover:bg-header-footer-foreground/10 text-header-footer-foreground" onClick={() => setMobileSearchOpen((v) => !v)} aria-label="Åpne søk" aria-expanded={mobileSearchOpen} aria-controls="mobile-search">
              <Search className="h-5 w-5" />
            </Button>
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 hover:bg-header-footer-foreground/10 text-header-footer-foreground" aria-label="Åpne meny">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">
                <SheetHeader className="px-5 py-4 border-b">
                  <SheetTitle className="text-left">Meny</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto overflow-x-hidden px-2">
                  {drawerGroup("Fagområder", [{ name: "Alle nyheter", to: "/" }, ...PRIMARY, ...MORE_TOPICS])}
                  {drawerGroup("Kategorier", CATEGORIES)}
                  {drawerGroup("Tjenester", MORE_SERVICES)}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {mobileSearchOpen && (
          <div id="mobile-search" className="lg:hidden pb-4">
            <SearchAutocomplete />
          </div>
        )}
      </div>
    </nav>
  );
};
