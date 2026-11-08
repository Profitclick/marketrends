import { Navigate, useParams } from "react-router-dom";
import { getCluster } from "@/config/clusters";
import NotFound from "./NotFound";

/** Legacy /cluster/:slug → canonical short vertical URL (one hop). */
const clusterRedirectTarget = (slug?: string) => {
  const c = slug ? getCluster(slug) : null;
  return c?.vertical ?? null;
};

const ClusterRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const target = clusterRedirectTarget(slug);
  return target ? <Navigate to={target} replace /> : <NotFound />;
};

export default ClusterRedirect;
