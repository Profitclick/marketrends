import { ClientOnly, createFileRoute, notFound } from "@tanstack/react-router";
import ClusterPage from "@/pages/ClusterPage";
import { getClusterRouteData } from "@/lib/routeServer";
import { clusterMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";
import { ClusterRouteShell } from "@/components/ssr/RouteShells";

export const Route = createFileRoute("/ai")({
  loader: async () => {
    const result = await getClusterRouteData({ data: { slug: "ai" } });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: ({ loaderData }) => toTanStackHead(clusterMetadata(loaderData.cluster)),
  component: AiRoute,
});

function AiRoute() {
  const data = Route.useLoaderData();
  return (
    <ClientOnly fallback={<ClusterRouteShell data={data} />}>
      <ClusterPage overrideSlug="ai" />
    </ClientOnly>
  );
}
