import { createFileRoute, notFound } from "@tanstack/react-router";
import CategoryPage from "@/pages/CategoryPage";
import { getCategoryRouteData } from "@/lib/routeServer";
import { categoryMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";

export const Route = createFileRoute("/kategori/$slug")({
  loader: async ({ params }) => {
    const result = await getCategoryRouteData({ data: { slug: params.slug } });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: ({ loaderData, params }) =>
    loaderData ? toTanStackHead(categoryMetadata(params.slug, loaderData.category)) : {},
  component: CategoryRoute,
});

function CategoryRoute() {
  const data = Route.useLoaderData();
  return <CategoryPage key={data.category.name} initialData={data} />;
}
