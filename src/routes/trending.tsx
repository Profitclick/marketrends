import { createFileRoute } from "@tanstack/react-router";
import Trending from "@/pages/Trending";
import { toTanStackHead } from "@/lib/routeHead";

export const Route = createFileRoute("/trending")({
  head: () =>
    toTanStackHead({
      title: "Trending nå – Hva beveger markedet i dag?",
      description:
        "Sanntidsoversikt over de mest leste artiklene, raskest voksende temaene og mest omtalte aktørene innen finans, krypto, AI og teknologi i Norge.",
      canonicalUrl: "https://marketrends.no/trending",
      ogType: "website",
    }),
  component: Trending,
});
