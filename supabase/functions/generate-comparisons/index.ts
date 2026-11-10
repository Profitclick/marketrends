// Generate "X vs Y" comparison pages between trending entities of compatible types.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";
import { evergreenGuard, logGuard, type GuardResult, type TitleEntry } from "../_shared/evergreen-guard.ts";
import { DbClient, errMsg } from "../_shared/db.ts";

type FaqItem = { q: string; a: string };
type ComparisonOutput = {
  title: string; summary: string; content: string;
  pros_cons?: Record<string, string[]>; faq?: FaqItem[];
  meta_title: string; meta_description: string;
};
type SeedPair = { a: string; b: string; slug: string };

const MODEL = "google/gemini-3-flash-preview";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[æå]/g, "a").replace(/ø/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function aiJson<T>(prompt: string, key: string): Promise<T> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Du er en nøytral norsk fagjournalist. Lever JSON. Ingen markedsføringsspråk." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  return JSON.parse((await res.json()).choices[0].message.content) as T;
}

// Curated comparison pairs (seed list). Auto-pair eligible entities by type otherwise.
const SEED_PAIRS: { a: string; b: string }[] = [
  { a: "Bitcoin", b: "Ethereum" },
  { a: "OpenAI", b: "Anthropic" },
  { a: "ChatGPT", b: "Claude" },
  { a: "Stripe", b: "Vipps" },
  { a: "Solana", b: "Ethereum" },
  { a: "Nvidia", b: "AMD" },
  { a: "Tesla", b: "BYD" },
  { a: "Coinbase", b: "Binance" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return unauthorized(corsHeaders);
  const key = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!) as unknown as DbClient;

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 4, 10);

    const dryRun = body.dry_run === true;
    const allowUpdate = body.allow_update === true;
    const cache: { titles?: TitleEntry[] } = {};
    const verdicts: (GuardResult & { slug: string })[] = [];
    const pending: SeedPair[] = [];
    for (const p of SEED_PAIRS.map(p => ({ ...p, slug: `${slugify(p.a)}-vs-${slugify(p.b)}` }))) {
      const input = { type: "comparison" as const, slug: p.slug, title: `${p.a} vs ${p.b}: En faglig sammenligning`,
        text: `Sammenligning av ${p.a} og ${p.b}.`, entities: [slugify(p.a), slugify(p.b)],
        altSlugs: [`${slugify(p.b)}-vs-${slugify(p.a)}`] };
      const r = await evergreenGuard(supabase, key, input, { allowUpdate, cache });
      verdicts.push({ slug: p.slug, ...r });
      if (!dryRun && r.decision !== "CREATE_NEW" && !(r.decision === "UPDATE_EXISTING" && allowUpdate)) await logGuard(supabase, input, r, "blocked-pre-generation");
      if (r.decision === "CREATE_NEW" || (r.decision === "UPDATE_EXISTING" && allowUpdate && r.match?.ref === p.slug)) pending.push(p);
    }
    if (dryRun) {
      return new Response(JSON.stringify({ dry_run: true, verdicts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let generated = 0, errors = 0;
    for (const p of pending.slice(0, limit)) {
      try {
        const prompt = `Skriv en sammenligningsside "${p.a} vs ${p.b}" på norsk for finans/tech-lesere.
Returner JSON:
{
 "title": "${p.a} vs ${p.b}: En faglig sammenligning",
 "summary": "2-3 setninger ingress",
 "content": "Markdown ~700-900 ord med ## Oversikt, ## Sentrale forskjeller, ## Bruksområder, ## Norsk kontekst",
 "pros_cons": {"a_pros":["..."],"a_cons":["..."],"b_pros":["..."],"b_cons":["..."]},
 "faq": [{"q":"...","a":"..."}, {"q":"...","a":"..."}, {"q":"...","a":"..."}, {"q":"...","a":"..."}],
 "meta_title": "<=60 tegn",
 "meta_description": "<=160 tegn"
}`;
        const out = await aiJson<ComparisonOutput>(prompt, key);
        const schema = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: (out.faq || []).map((f) => ({
            "@type": "Question", name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        };
        await supabase.from("comparison_pages").upsert({
          slug: p.slug, title: out.title, entity_a: p.a, entity_b: p.b,
          content: out.content, summary: out.summary,
          pros_cons_json: out.pros_cons || {}, faq_json: out.faq || [],
          schema_json: schema, meta_title: out.meta_title, meta_description: out.meta_description,
        }, { onConflict: "slug" });
        generated++;
        await new Promise((r) => setTimeout(r, 3000));
      } catch (e) {
        console.error("pair", p.slug, e); errors++;
      }
    }

    return new Response(JSON.stringify({ generated, errors, pending: pending.length, verdicts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: errMsg(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
