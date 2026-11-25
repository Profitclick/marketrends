import { ClientOnly, createFileRoute, notFound } from "@tanstack/react-router";
import ComparePage from "@/pages/ComparePage";
import { getCompareRouteData } from "@/lib/routeServer";
import { compareMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";
import { CompareRouteShell } from "@/components/ssr/RouteShells";

export const Route = createFileRoute("/compare/$slug")({
  loader: async ({ params }) => {
    const result = await getCompareRouteData({ data: { slug: params.slug } });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: ({ loaderData }) => loaderData ? toTanStackHead(compareMetadata(loaderData)) : {},
  component: CompareRoute,
});

function CompareRoute() {
  const page = Route.useLoaderData();
  return (
    <ClientOnly fallback={<CompareRouteShell page={page} />}>
      <ComparePage />
    </ClientOnly>
  );
}
