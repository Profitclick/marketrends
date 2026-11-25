import { ClientOnly, createFileRoute, notFound } from "@tanstack/react-router";
import KnowledgePage from "@/pages/KnowledgePage";
import { getKnowledgeRouteData } from "@/lib/routeServer";
import { knowledgeMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";
import { KnowledgeRouteShell } from "@/components/ssr/RouteShells";

export const Route = createFileRoute("/knowledge/$slug")({
  loader: async ({ params }) => {
    const result = await getKnowledgeRouteData({ data: { slug: params.slug } });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: ({ loaderData }) => toTanStackHead(knowledgeMetadata(loaderData)),
  component: KnowledgeRoute,
});

function KnowledgeRoute() {
  const page = Route.useLoaderData();
  return (
    <ClientOnly fallback={<KnowledgeRouteShell page={page} />}>
      <KnowledgePage />
    </ClientOnly>
  );
}
