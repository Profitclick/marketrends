import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isAdmin, loading } = useAuth();
  const [signOut, setSignOut] = useState<"idle" | "pending" | "failed">("idle");

  const handleSignOut = async () => {
    setSignOut("pending");
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      setSignOut(error ? "failed" : "idle");
    } catch {
      setSignOut("failed");
    }
  };

  if (loading && signOut === "idle") {
    return (
      <div className="min-h-dvh flex items-center justify-center text-sm text-muted-foreground">
        Verifiserer tilgang…
      </div>
    );
  }

  // Supabase can clear the local session before the logout request finishes.
  if (!session && signOut === "idle") return <Navigate to="/auth" replace />;

  if (!isAdmin || signOut !== "idle") {
    const localSessionEnded = signOut === "failed" && !session;
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-xl font-semibold">Tilgang nektet</h1>
        <p className="text-sm text-muted-foreground">
          Kontoen din har ikke administratortilgang.
        </p>
        {signOut === "failed" && (
          <p role="alert" className="text-sm text-destructive">
            {localSessionEnded
              ? "Denne økten er avsluttet lokalt. Utlogging på serveren kunne ikke bekreftes."
              : "Utloggingen mislyktes. Prøv igjen."}
          </p>
        )}
        {localSessionEnded ? (
          <Button asChild><Link to="/auth" replace>Gå til innlogging</Link></Button>
        ) : (
          <Button type="button" onClick={handleSignOut} disabled={signOut === "pending"}>
            {signOut === "pending" ? "Logger ut…" : "Logg ut / bytt konto"}
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
};
