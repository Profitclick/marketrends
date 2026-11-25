import { ClientOnly, createFileRoute, notFound } from "@tanstack/react-router";
import NewsView from "@/pages/NewsView";
import { getNewsRouteData } from "@/lib/routeServer";
import { articleMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";
import { ArticleRouteShell } from "@/components/ssr/RouteShells";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const result = await getNewsRouteData({ data: { slug: params.slug } });
    if (result.status !== "found" || !result.data.selectedArticle) throw notFound();
    return result.data;
  },
  head: ({ loaderData }) => {
    if (!loaderData?.selectedArticle) return {};
    const article = loaderData.selectedArticle;
    return toTanStackHead(articleMetadata(article));
  },
  component: ArticleRoute,
});

function ArticleRoute() {
  const data = Route.useLoaderData();
  return (
    <ClientOnly fallback={<ArticleRouteShell data={data} />}>
      <NewsView />
    </ClientOnly>
  );
}
