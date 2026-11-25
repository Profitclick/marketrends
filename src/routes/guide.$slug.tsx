import { createFileRoute, notFound } from "@tanstack/react-router";
import GuidePage from "@/pages/GuidePage";
import { getGuideRouteData } from "@/lib/routeServer";
import { guideMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";

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
  return <GuidePage key={page.slug} initialData={page} />;
}
