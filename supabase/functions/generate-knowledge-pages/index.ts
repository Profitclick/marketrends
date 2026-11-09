// Auto-generate "What is X?" evergreen pages from topics with >=5 articles.
// Uses Lovable AI Gateway. Idempotent: skips topics that already have a knowledge_page.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";
import { evergreenGuard, logGuard, type GuardResult, type TitleEntry } from "../_shared/evergreen-guard.ts";
import { errMsg } from "../_shared/db.ts";

type TopicRow = { id: string; slug: string; name: string; description: string | null; category_hint: string | null; article_count: number };
type FaqItem = { q: string; a: string };
type KnowledgeOutput = {
  title: string; summary: string; content: string;
  key_takeaways?: string[]; faq?: FaqItem[];
  meta_title: string; meta_description: string;
};

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
        { role: "system", content: "Du er en nøktern norsk fagjournalist for Markettrends.no. Skriv objektivt og faktabasert på norsk bokmål. Returner kun gyldig JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as T;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return unauthorized(corsHeaders);
  const key = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 5, 20);

    const { data: topicData } = await supabase
      .from("topics")
      .select("id, slug, name, description, category_hint, article_count")
      .gte("article_count", 5)
      .order("trending_score", { ascending: false })
      .limit(50);
    const topics = (topicData || []) as unknown as TopicRow[];

    if (!topics.length) {
      return new Response(JSON.stringify({ generated: 0, message: "No eligible topics" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingData } = await supabase
      .from("knowledge_pages").select("topic_id").not("topic_id", "is", null);
    const done = new Set(((existingData || []) as { topic_id: string | null }[]).map((e) => e.topic_id));

    const dryRun = body.dry_run === true;
    const allowUpdate = body.allow_update === true;
    const cache: { titles?: TitleEntry[] } = {};
    const verdicts: (GuardResult & { slug: string })[] = [];
    const pending: TopicRow[] = [];
    const scan = topics.filter((t) => dryRun || !done.has(t.id)).slice(0, dryRun ? Math.min(Number(body.limit) || 10, 20) : limit * 3);
    for (const t of scan) {
      const slug = `hva-er-${slugify(t.name)}`;
      const input = { type: "knowledge" as const, slug, title: `Hva er ${t.name}?`, text: `${t.name}. ${t.description || ""}`, topics: [t.slug] };
      const r = await evergreenGuard(supabase, key, input, { allowUpdate, cache });
      verdicts.push({ slug, ...r });
      if (!dryRun && r.decision !== "CREATE_NEW" && !(r.decision === "UPDATE_EXISTING" && allowUpdate)) await logGuard(supabase, input, r, "blocked-pre-generation");
      if (r.decision === "CREATE_NEW" || (r.decision === "UPDATE_EXISTING" && allowUpdate && r.match?.ref === slug)) pending.push(t);
    }
    if (dryRun) {
      return new Response(JSON.stringify({ dry_run: true, verdicts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let generated = 0, errors = 0;

    for (const t of pending.slice(0, limit)) {
      try {
        const prompt = `Skriv en evergreen kunnskapsside om "${t.name}" på norsk for et finans/tech-publikum.
${t.description ? `Kort kontekst: ${t.description}` : ""}
Returner JSON med feltene:
{
 "title": "Hva er ${t.name}? (norsk vinkling)",
 "summary": "2-3 setninger ingress",
 "content": "Markdown-artikkel ~600-900 ord med seksjoner: ## Hva er det?, ## Hvordan fungerer det?, ## Hvorfor er det viktig?, ## Risiko og begrensninger, ## Norsk kontekst",
 "key_takeaways": ["punkt 1","punkt 2","punkt 3","punkt 4","punkt 5"],
 "faq": [{"q":"...","a":"..."}, {"q":"...","a":"..."}, {"q":"...","a":"..."}, {"q":"...","a":"..."}, {"q":"...","a":"..."}],
 "meta_title": "<=60 tegn",
 "meta_description": "<=160 tegn"
}`;
        const out = await aiJson<KnowledgeOutput>(prompt, key);
        const slug = `hva-er-${slugify(t.name)}`;
        const schema = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: (out.faq || []).map((f) => ({
            "@type": "Question", name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        };
        await supabase.from("knowledge_pages").upsert({
          slug, title: out.title, category: t.category_hint || "kunnskap",
          topic_id: t.id, content: out.content, summary: out.summary,
          faq_json: out.faq || [], key_takeaways_json: out.key_takeaways || [],
          schema_json: schema, meta_title: out.meta_title, meta_description: out.meta_description,
          canonical_url: `https://marketrends.no/knowledge/${slug}`,
        }, { onConflict: "slug" });
        generated++;
        await new Promise((r) => setTimeout(r, 3000));
      } catch (e) {
        console.error("topic", t.slug, e);
        errors++;
      }
    }

    return new Response(JSON.stringify({ generated, errors, eligible: topics.length, pending: pending.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: errMsg(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
