import { createFileRoute, notFound } from "@tanstack/react-router";
import KnowledgePage from "@/pages/KnowledgePage";
import { getKnowledgeRouteData } from "@/lib/routeServer";
import { knowledgeMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";

export const Route = createFileRoute("/knowledge/$slug")({
  loader: async ({ params }) => {
    const result = await getKnowledgeRouteData({ data: { slug: params.slug } });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: ({ loaderData }) => loaderData ? toTanStackHead(knowledgeMetadata(loaderData)) : {},
  component: KnowledgeRoute,
});

function KnowledgeRoute() {
  const page = Route.useLoaderData();
  return <KnowledgePage key={page.slug} initialData={page} />;
}
