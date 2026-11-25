import { createFileRoute, notFound } from "@tanstack/react-router";
import ClusterPage from "@/pages/ClusterPage";
import { getClusterRouteData } from "@/lib/routeServer";
import { clusterMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";

export const Route = createFileRoute("/investering")({
  loader: async () => {
    const result = await getClusterRouteData({ data: { slug: "investering" } });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: ({ loaderData }) =>
    loaderData ? toTanStackHead(clusterMetadata(loaderData.cluster)) : {},
  component: InvesteringRoute,
});

function InvesteringRoute() {
  const data = Route.useLoaderData();
  return <ClusterPage key={data.cluster.slug} overrideSlug="investering" initialData={data} />;
}
