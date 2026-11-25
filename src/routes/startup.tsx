import { ClientOnly, createFileRoute, notFound } from "@tanstack/react-router";
import ClusterPage from "@/pages/ClusterPage";
import { getClusterRouteData } from "@/lib/routeServer";
import { clusterMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";
import { ClusterRouteShell } from "@/components/ssr/RouteShells";

export const Route = createFileRoute("/startup")({
  loader: async () => {
    const result = await getClusterRouteData({ data: { slug: "startup" } });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: ({ loaderData }) =>
    loaderData ? toTanStackHead(clusterMetadata(loaderData.cluster)) : {},
  component: StartupRoute,
});

function StartupRoute() {
  const data = Route.useLoaderData();
  return (
    <ClientOnly fallback={<ClusterRouteShell data={data} />}>
      <ClusterPage overrideSlug="startup" />
    </ClientOnly>
  );
}
