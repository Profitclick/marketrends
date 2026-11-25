import { createFileRoute } from "@tanstack/react-router";
import Resources from "@/pages/Resources";
import { toTanStackHead } from "@/lib/routeHead";

export const Route = createFileRoute("/ressurser")({
  head: () =>
    toTanStackHead({
      title: "Ressurssenter – data, kilder og rapporter",
      description:
        "Marketrends sitt åpne ressursbibliotek: forskningsrapporter, datasett, statistikk og offentlige kilder for norske markeder.",
      canonicalUrl: "https://marketrends.no/ressurser",
      ogType: "website",
    }),
  component: Resources,
});
