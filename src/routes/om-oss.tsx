import { createFileRoute } from "@tanstack/react-router";
import About from "@/pages/About";
import { toTanStackHead } from "@/lib/routeHead";

export const Route = createFileRoute("/om-oss")({
  head: () =>
    toTanStackHead({
      title: "Om oss",
      description:
        "Marketrends.no er Norges ledende kilde for finans, teknologi, krypto og markedsnyheter. Møt redaksjonen bak nyhetene.",
      canonicalUrl: "https://marketrends.no/om-oss",
      ogType: "website",
      breadcrumbs: [
        { name: "Hjem", url: "https://marketrends.no" },
        { name: "Om oss", url: "https://marketrends.no/om-oss" },
      ],
    }),
  component: About,
});
