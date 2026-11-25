import { ClientOnly, createFileRoute, notFound } from "@tanstack/react-router";
import GuidePage from "@/pages/GuidePage";
import { getGuideRouteData } from "@/lib/routeServer";
import { guideMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";
import { GuideRouteShell } from "@/components/ssr/RouteShells";

export const Route = createFileRoute("/guide/$slug")({
  loader: async ({ params }) => {
    const result = await getGuideRouteData({ data: { slug: params.slug } });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: ({ loaderData }) => loaderData ? toTanStackHead(guideMetadata(loaderData)) : {},
  component: GuideRoute,
});

function GuideRoute() {
  const page = Route.useLoaderData();
  return (
    <ClientOnly fallback={<GuideRouteShell page={page} />}>
      <GuidePage />
    </ClientOnly>
  );
}
