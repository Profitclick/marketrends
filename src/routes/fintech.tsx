import { createFileRoute, notFound } from "@tanstack/react-router";
import ClusterPage from "@/pages/ClusterPage";
import { getClusterRouteData } from "@/lib/routeServer";
import { clusterMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";

export const Route = createFileRoute("/fintech")({
  loader: async () => {
    const result = await getClusterRouteData({ data: { slug: "fintech" } });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: ({ loaderData }) =>
    loaderData ? toTanStackHead(clusterMetadata(loaderData.cluster)) : {},
  component: FintechRoute,
});

function FintechRoute() {
  const data = Route.useLoaderData();
  return <ClusterPage key={data.cluster.slug} overrideSlug="fintech" initialData={data} />;
}
