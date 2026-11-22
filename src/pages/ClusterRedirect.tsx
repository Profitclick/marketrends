import { Navigate, useParams } from "react-router-dom";
import { resolveLegacyClusterRoute } from "@/lib/routeResolution";
import NotFound from "./NotFound";

/** Legacy /cluster/:slug → canonical short vertical URL (one hop). */
export const clusterRedirectTarget = (slug?: string) => {
  const outcome = resolveLegacyClusterRoute(slug);
  return outcome.status === "redirect" ? outcome.to : null;
};

const ClusterRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const target = clusterRedirectTarget(slug);
  return target ? <Navigate to={target} replace /> : <NotFound />;
};

export default ClusterRedirect;
