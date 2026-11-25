import { ClientOnly, createFileRoute, notFound } from "@tanstack/react-router";
import ClusterPage from "@/pages/ClusterPage";
import { getClusterRouteData } from "@/lib/routeServer";
import { clusterMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";
import { ClusterRouteShell } from "@/components/ssr/RouteShells";

export const Route = createFileRoute("/daytrading")({
  loader: async () => {
    const result = await getClusterRouteData({ data: { slug: "daytrading" } });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: ({ loaderData }) => toTanStackHead(clusterMetadata(loaderData.cluster)),
  component: DaytradingRoute,
});

function DaytradingRoute() {
  const data = Route.useLoaderData();
  return (
    <ClientOnly fallback={<ClusterRouteShell data={data} />}>
      <ClusterPage overrideSlug="daytrading" />
    </ClientOnly>
  );
}
