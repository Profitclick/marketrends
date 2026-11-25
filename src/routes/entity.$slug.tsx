import { ClientOnly, createFileRoute, notFound } from "@tanstack/react-router";
import EntityPage from "@/pages/EntityPage";
import { getEntityRouteData } from "@/lib/routeServer";
import { entityMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";
import { EntityRouteShell } from "@/components/ssr/RouteShells";

export const Route = createFileRoute("/entity/$slug")({
  loader: async ({ params }) => {
    const result = await getEntityRouteData({ data: { slug: params.slug } });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: ({ loaderData }) => {
    const { seo, entitySchema } = entityMetadata(loaderData.entity);
    return toTanStackHead(seo, { extraSchemas: [entitySchema] });
  },
  component: EntityRoute,
});

function EntityRoute() {
  const data = Route.useLoaderData();
  return (
    <ClientOnly fallback={<EntityRouteShell data={data} />}>
      <EntityPage />
    </ClientOnly>
  );
}
