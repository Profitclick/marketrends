import { ReactNode } from "react";
import { Navigation } from "@/components/Navigation";
import { MarketTicker } from "@/components/MarketTicker";
import { NewsFooter } from "@/components/NewsFooter";
import { Container } from "./Container";

interface PageShellProps {
  children: ReactNode;
  /** Hide market ticker (e.g. for admin/dashboard) */
  hideTicker?: boolean;
  /** Skip the standard 1200px container wrap (page renders its own) */
  bare?: boolean;
  /** Extra classes on <main> */
  mainClassName?: string;
}

/**
 * Standard page shell: ticker → nav → main → footer.
 * Guarantees exactly one <main> landmark and a skip-link.
 */
export const PageShell = ({
  children,
  hideTicker = false,
  bare = false,
  mainClassName,
}: PageShellProps) => (
  <div className="min-h-dvh bg-background flex flex-col">
    <a href="#main-content" className="skip-link">Hopp til hovedinnhold</a>
    {!hideTicker && <MarketTicker />}
    <Navigation />
    <main id="main-content" className={mainClassName ?? "flex-1"}>
      {bare ? children : <Container className="py-6 md:py-10">{children}</Container>}
    </main>
    <NewsFooter />
  </div>
);
