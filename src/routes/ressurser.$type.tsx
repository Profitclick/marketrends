import { createFileRoute, notFound } from "@tanstack/react-router";
import Resources, { isResourceType } from "@/pages/Resources";
import { toTanStackHead } from "@/lib/routeHead";

export const Route = createFileRoute("/ressurser/$type")({
  loader: ({ params }) => {
    if (!isResourceType(params.type)) throw notFound();
  },
  head: ({ params }) => isResourceType(params.type) ?
    toTanStackHead({
      title: "Ressurssenter – data, kilder og rapporter",
      description:
        "Marketrends sitt åpne ressursbibliotek: forskningsrapporter, datasett, statistikk og offentlige kilder for norske markeder.",
      canonicalUrl: "https://marketrends.no/ressurser",
      ogType: "website",
    }) : {},
  component: Resources,
});
