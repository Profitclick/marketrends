import { getCluster } from "@/config/clusters";

export type RouteResolution<T> =
  | { status: "found"; data: T }
  | { status: "not_found" }
  | { status: "redirect"; to: string; statusCode: 301 | 302 | 307 | 308 };

export const routeFound = <T>(data: T): RouteResolution<T> => ({ status: "found", data });
export const routeNotFound = <T = never>(): RouteResolution<T> => ({ status: "not_found" });
export const routeRedirect = <T = never>(
  to: string,
  statusCode: 301 | 302 | 307 | 308 = 308,
): RouteResolution<T> => ({ status: "redirect", to, statusCode });

/**
 * Framework-independent legacy cluster resolution.
 *
 * React Router currently consumes this client-side. A future TanStack Start
 * server loader can translate the exact same outcome into notFound() or
 * redirect({ to, statusCode }) without reimplementing cluster policy.
 */
export function resolveLegacyClusterRoute(slug?: string): RouteResolution<never> {
  if (!slug) return routeNotFound();
  const cluster = getCluster(slug);
  return cluster?.vertical ? routeRedirect(cluster.vertical, 308) : routeNotFound();
}
