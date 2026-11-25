import { createFileRoute } from "@tanstack/react-router";
import Academy from "@/pages/Academy";
import { toTanStackHead } from "@/lib/routeHead";

export const Route = createFileRoute("/academy")({
  head: () =>
    toTanStackHead({
      title: "Markettrends Academy – Lær finans, AI og entreprenørskap",
      description:
        "Norsk læringshub for finans, AI, SaaS, krypto og entreprenørskap. Strukturerte guider og kunnskapssider basert på dagsaktuelle nyheter.",
      canonicalUrl: "https://marketrends.no/academy",
      ogType: "website",
      breadcrumbs: [
        { name: "Hjem", url: "https://marketrends.no" },
        { name: "Academy", url: "https://marketrends.no/academy" },
      ],
    }),
  component: Academy,
});
