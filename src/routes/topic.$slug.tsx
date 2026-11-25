import { ClientOnly, createFileRoute, notFound } from "@tanstack/react-router";
import TopicPage from "@/pages/TopicPage";
import { getTopicRouteData } from "@/lib/routeServer";
import { topicMetadata } from "@/lib/routeMetadata";
import { toTanStackHead } from "@/lib/routeHead";
import { TopicRouteShell } from "@/components/ssr/RouteShells";

export const Route = createFileRoute("/topic/$slug")({
  loader: async ({ params }) => {
    const result = await getTopicRouteData({ data: { slug: params.slug } });
    if (result.status !== "found") throw notFound();
    return result.data;
  },
  head: ({ loaderData }) =>
    loaderData
      ? toTanStackHead(
          topicMetadata(loaderData.topic, loaderData.articles, loaderData.hero, loaderData.entities),
        )
      : {},
  component: TopicRoute,
});

function TopicRoute() {
  const data = Route.useLoaderData();
  return (
    <ClientOnly fallback={<TopicRouteShell data={data} />}>
      <TopicPage />
    </ClientOnly>
  );
}
