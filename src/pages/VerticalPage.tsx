import { useLocation } from "react-router-dom";
import { getClusterByVertical } from "@/config/clusters";
import ClusterPage from "./ClusterPage";
import NotFound from "./NotFound";

const VerticalPage = () => {
  const { pathname } = useLocation();
  const cluster = getClusterByVertical(pathname);
  if (!cluster) return <NotFound />;
  return <ClusterPage overrideSlug={cluster.slug} />;
};

export default VerticalPage;
