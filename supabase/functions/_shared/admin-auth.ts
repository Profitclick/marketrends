import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Allow: service-role invocation (internal fan-out), a scheduler call carrying
 * the shared CRON_SECRET header, or an admin user JWT.
 */
export async function requireAdmin(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  const presented = req.headers.get("x-cron-secret");
  if (presented) {
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret && presented === cronSecret) {
      return { ok: true as const, supabase: admin, actor: "cron" as const };
    }
    // Scheduler token lives in the database so pg_cron can present it without
    // the value ever being embedded in SQL or readable by app clients.
    const { data: row } = await admin.from("cron_tokens")
      .select("token").eq("name", "scheduler").maybeSingle();
    if (row?.token && presented === row.token) {
      return { ok: true as const, supabase: admin, actor: "cron" as const };
    }
  }


  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (bearer && bearer === serviceKey) {
    return { ok: true as const, supabase: admin, actor: "service_role" as const };
  }
  if (bearer) {
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data } = await userClient.auth.getUser();
    if (data?.user) {
      const { data: role } = await admin.from("user_roles").select("role")
        .eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
      if (role) return { ok: true as const, supabase: admin, actor: "admin" as const };
    }
  }
  return { ok: false as const, supabase: admin, actor: null };
}

export function unauthorized(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Headers used when one edge function invokes another. */
export function internalHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const cron = Deno.env.get("CRON_SECRET");
  if (cron) h["x-cron-secret"] = cron;
  h["Authorization"] = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  return h;
}
