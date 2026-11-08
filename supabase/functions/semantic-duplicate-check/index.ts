// Standalone semantic duplicate check. POST a candidate, get a verdict + logged decision.
// Body: { type, ref, title, text, entities?, topics?, event?, source_url?, canonical_url?, published_at?, log? }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAdmin } from "../_shared/admin-auth.ts";
import { evaluateDuplicate, recordVerdict } from "../_shared/dupe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const body = await req.json();
    if (!body?.title || !body?.type || !body?.ref) {
      return new Response(JSON.stringify({ error: "type, ref and title are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const candidate = { text: "", ...body };
    const verdict = await evaluateDuplicate(auth.supabase, Deno.env.get("LOVABLE_API_KEY")!, candidate);
    if (body.log !== false) await recordVerdict(auth.supabase, candidate, verdict, "check-only");

    const { embedding, ...rest } = verdict;
    return new Response(JSON.stringify(rest), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e_: unknown) { const e = e_ instanceof Error ? e_ : new Error(String(e_));
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
