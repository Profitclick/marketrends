import { createFileRoute } from "@tanstack/react-router";
import Newsletter from "@/pages/Newsletter";
import { toTanStackHead } from "@/lib/routeHead";

export const Route = createFileRoute("/newsletter")({
  head: () =>
    toTanStackHead({
      title: "Newsletter Center – temabaserte nyhetsbrev",
      description:
        "Meld deg på Marketrends sine temabaserte nyhetsbrev innen AI, krypto, fintech, startup, investering og trading.",
      canonicalUrl: "https://marketrends.no/newsletter",
      ogType: "website",
    }),
  component: Newsletter,
});
