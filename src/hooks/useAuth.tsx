import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Access = { userId: string; isAdmin: boolean };

export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [access, setAccess] = useState<Access | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setAccess(current => current?.userId === nextSession?.user.id ? current : null);
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const settle = (isAdmin: boolean) => {
      if (active) setAccess({ userId, isAdmin });
    };
    void supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data, error }) => settle(!error && data?.role === "admin"), () => settle(false));
    return () => { active = false; };
  }, [userId]);

  const currentAccess = access?.userId === userId ? access : null;
  return {
    session: session ?? null,
    user: session?.user ?? null,
    isAdmin: currentAccess?.isAdmin ?? false,
    loading: session === undefined || (!!userId && !currentAccess),
  };
}
