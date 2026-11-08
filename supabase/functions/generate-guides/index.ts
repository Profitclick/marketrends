// Generate how-to guides from a curated topic list.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";
import { evergreenGuard, logGuard, type EvergreenAiOutput, type GuardCache, type GuardVerdict } from "../_shared/evergreen-guard.ts";

const MODEL = "google/gemini-3-flash-preview";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[æå]/g, "a").replace(/ø/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const SEED_GUIDES: { title: string; category: string; difficulty: string }[] = [
  { title: "Slik starter du en startup i Norge", category: "entreprenørskap", difficulty: "beginner" },
  { title: "Slik lanserer du en SaaS", category: "saas", difficulty: "intermediate" },
  { title: "Slik investerer du i indeksfond", category: "investering", difficulty: "beginner" },
  { title: "Slik bygger du en AI-bedrift", category: "ai", difficulty: "intermediate" },
  { title: "Slik validerer du en forretningsidé", category: "entreprenørskap", difficulty: "beginner" },
  { title: "Slik bruker du AI til markedsføring", category: "ai", difficulty: "beginner" },
  { title: "Slik skaper du passiv inntekt på nett", category: "online-business", difficulty: "intermediate" },
  { title: "Slik kommer du i gang med kryptovaluta i Norge", category: "krypto", difficulty: "beginner" },
  { title: "Slik bygger du en investeringsportefølje", category: "investering", difficulty: "intermediate" },
  { title: "Slik regner du ut SaaS-verdsettelse", category: "saas", difficulty: "advanced" },
];

async function aiJson(prompt: string, key: string): Promise<EvergreenAiOutput> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Du er en norsk fagjournalist. Skriv konkret, faktabasert og objektivt. Returner JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  return JSON.parse((await res.json()).choices[0].message.content);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return unauthorized(corsHeaders);
  const key = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 3, 10);

    const dryRun = body.dry_run === true;
    const allowUpdate = body.allow_update === true;
    const cache: GuardCache = {};
    const verdicts: GuardVerdict[] = [];
    const pending: ((typeof SEED_GUIDES)[number] & { slug: string })[] = [];
    for (const g of SEED_GUIDES.map(g => ({ ...g, slug: slugify(g.title) }))) {
      const input = { type: "guide" as const, slug: g.slug, title: g.title, text: `${g.title}. Kategori: ${g.category}.`, topics: [g.category] };
      const r = await evergreenGuard(supabase, key, input, { allowUpdate, cache });
      verdicts.push({ slug: g.slug, ...r });
      if (!dryRun && r.decision !== "CREATE_NEW" && !(r.decision === "UPDATE_EXISTING" && allowUpdate)) await logGuard(supabase, input, r, "blocked-pre-generation");
      if (r.decision === "CREATE_NEW" || (r.decision === "UPDATE_EXISTING" && allowUpdate && r.match?.ref === g.slug)) pending.push(g);
    }
    if (dryRun) {
      return new Response(JSON.stringify({ dry_run: true, verdicts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let generated = 0, errors = 0;
    for (const g of pending.slice(0, limit)) {
      try {
        const prompt = `Skriv en how-to guide "${g.title}" på norsk for ${g.category}-lesere (vanskelighet: ${g.difficulty}).
Returner JSON:
{
 "summary": "2-3 setninger ingress",
 "content": "Markdown ~800-1000 ord med innledning og 6-10 nummererte steg",
 "steps": [{"title":"Steg 1: ...","description":"..."}, ...],
 "faq": [{"q":"...","a":"..."}, {"q":"...","a":"..."}, {"q":"...","a":"..."}, {"q":"...","a":"..."}],
 "resources": [{"title":"...","note":"..."}, {"title":"...","note":"..."}],
 "estimated_read_time": 7,
 "meta_title": "<=60 tegn",
 "meta_description": "<=160 tegn"
}`;
        const out = await aiJson(prompt, key);
        await supabase.from("guides").upsert({
          slug: g.slug, title: g.title, category: g.category, difficulty: g.difficulty,
          content: out.content, summary: out.summary,
          steps_json: out.steps || [], faq_json: out.faq || [], resources_json: out.resources || [],
          estimated_read_time: out.estimated_read_time || 7,
          meta_title: out.meta_title, meta_description: out.meta_description,
        }, { onConflict: "slug" });
        generated++;
        await new Promise((r) => setTimeout(r, 3000));
      } catch (e) {
        console.error("guide", g.slug, e); errors++;
      }
    }

    return new Response(JSON.stringify({ generated, errors, pending: pending.length, verdicts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e_: unknown) { const e = e_ instanceof Error ? e_ : new Error(String(e_));
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
