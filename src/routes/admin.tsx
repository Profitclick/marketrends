import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { privateRouteHead } from "@/lib/routeHead";

export const Route = createFileRoute("/admin")({
  head: () => privateRouteHead("Admin"),
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <ClientOnly
      fallback={
        <div className="min-h-dvh flex items-center justify-center text-sm text-muted-foreground">
          Verifiserer tilgang…
        </div>
      }
    >
      <ProtectedRoute>
        <Index />
      </ProtectedRoute>
    </ClientOnly>
  );
}
