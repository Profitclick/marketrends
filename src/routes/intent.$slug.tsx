import { createFileRoute, notFound } from "@tanstack/react-router";
import SearchIntentPage from "@/pages/SearchIntentPage";
import { getSearchIntentRouteData } from "@/lib/routeServer";
import { searchIntentMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";

export const Route = createFileRoute("/intent/$slug")({
  loader: async ({ params }) => {
    const result = await getSearchIntentRouteData({ data: { slug: params.slug } });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: ({ loaderData }) =>
    loaderData
      ? toTanStackHead(searchIntentMetadata(loaderData.intent, loaderData.pillar))
      : {},
  component: IntentRoute,
});

function IntentRoute() {
  const data = Route.useLoaderData();
  return <SearchIntentPage key={data.intent.target_slug} initialData={data} />;
}
