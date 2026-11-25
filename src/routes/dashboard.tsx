import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
const Dashboard = lazy(() => import("@/pages/Dashboard"));
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { privateRouteHead } from "@/lib/routeHead";

export const Route = createFileRoute("/dashboard")({
  head: () => privateRouteHead("Dashboard"),
  component: DashboardRoute,
});

function PrivateFallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center text-sm text-muted-foreground">
      Verifiserer tilgang…
    </div>
  );
}

function DashboardRoute() {
  return (
    <ClientOnly fallback={<PrivateFallback />}>
      <ProtectedRoute>
        <Suspense fallback={<p>Laster…</p>}><Dashboard /></Suspense>
      </ProtectedRoute>
    </ClientOnly>
  );
}
