import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { resolveLegacyClusterRoute } from "@/lib/routeResolution";

export const Route = createFileRoute("/cluster/$slug")({
  loader: ({ params }) => {
    const result = resolveLegacyClusterRoute(params.slug);
    if (result.status === "redirect") {
      throw redirect({
        to: result.to as never,
        statusCode: result.statusCode,
      });
    }
    throw notFound();
  },
  component: () => null,
});
