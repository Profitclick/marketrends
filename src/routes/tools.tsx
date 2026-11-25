import { createFileRoute } from "@tanstack/react-router";
import Tools from "@/pages/Tools";
import { toTanStackHead } from "@/lib/routeHead";

export const Route = createFileRoute("/tools")({
  head: () =>
    toTanStackHead({
      title: "Verktøy – Kalkulatorer for finans, SaaS og startup",
      description:
        "Praktiske norske kalkulatorer for investering, SaaS-verdsettelse, runway, burn rate, AI ROI og mer. Bygget for grunnleggere og investorer.",
      canonicalUrl: "https://marketrends.no/tools",
      ogType: "website",
      breadcrumbs: [
        { name: "Hjem", url: "https://marketrends.no" },
        { name: "Verktøy", url: "https://marketrends.no/tools" },
      ],
    }),
  component: Tools,
});
