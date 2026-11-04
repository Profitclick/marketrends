import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-sm text-muted-foreground">
        Verifiserer tilgang…
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-xl font-semibold">Tilgang nektet</h1>
        <p className="text-sm text-muted-foreground">
          Kontoen din har ikke administratortilgang.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
