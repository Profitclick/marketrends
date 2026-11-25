import { createFileRoute, notFound } from "@tanstack/react-router";
import NewsView from "@/pages/NewsView";
import { getNewsRouteData } from "@/lib/routeServer";
import { homepageMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";

export const Route = createFileRoute("/")({
  loader: async () => {
    const result = await getNewsRouteData({ data: {} });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: () => toTanStackHead(homepageMetadata()),
  component: HomeRoute,
});

function HomeRoute() {
  const data = Route.useLoaderData();
  return <NewsView initialData={data} />;
}
