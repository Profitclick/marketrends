// Generate a search-intent page using the Lovable AI Gateway.
// Pipeline per intent:
//   1) AI generation with GEO/AEO blocks
//   2) Post-generation quality validation (rejects if fails)
//   3) Semantic Duplicate Detection V2 (embeddings + headline/entity/topic/event/url/time signals)
//        - duplicate  -> never publish a new page; log decision
//        - merge      -> update the existing page with the new verified information
//   4) Store embedding, auto-create internal_links, recompute authority
// Never overwrites a page already `published` unless `force: true`.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { evaluateDuplicate, recordVerdict, type Candidate } from "../_shared/dupe.ts";
import { embed } from "../_shared/semantic.ts";
import { evergreenGuard, logGuard } from "../_shared/evergreen-guard.ts";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";
import type { DbClient } from "../_shared/db.ts";

const MODEL = "google/gemini-3-flash-preview";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";


async function aiJson(prompt: string, key: string) {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Du er en nøktern norsk fagjournalist for Markettrends.no. Skriv objektivt og faktabasert på norsk bokmål. Ingen markedsføringsspråk. Returner kun gyldig JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  return JSON.parse((await res.json()).choices[0].message.content);
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[æå]/g, "a").replace(/ø/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function buildPrompt(intent: any, related: any) {
  return `Skriv en søkeintent-side for keyword "${intent.keyword}" (intent: ${intent.intent_type}, template: ${intent.template}) på norsk med norsk kontekst.
${related.topic ? `Tilknyttet tema: ${related.topic.name}.` : ""}
${related.entity ? `Tilknyttet entitet: ${related.entity.name} (${related.entity.entity_type || ""}).` : ""}
${related.secondary ? `Sammenlignes med: ${related.secondary.name}.` : ""}

Returner JSON med disse feltene:
{
 "title": "H1 (<=70 tegn, målrettet mot keyword)",
 "meta_title": "<=60 tegn",
 "meta_description": "<=160 tegn",
 "summary": "1-2 setninger ingress",
 "tldr": "1 setning oppsummering (<=180 tegn)",
 "quick_answer": "40-60 ord direkte svar egnet for AI/answer engines",
 "key_facts": ["5-7 korte faktapunkter"],
 "why_it_matters": "80-120 ord om hvorfor dette er relevant for norske lesere",
 "expert_summary": "120-160 ord analyse med norsk kontekst",
 "content": "Markdown 700-1000 ord med tydelige ## seksjoner tilpasset templaten",
 "faq": [{"q":"...","a":"..."}, {"q":"...","a":"..."}, {"q":"...","a":"..."}, {"q":"...","a":"..."}, {"q":"...","a":"..."}],
 "related_questions": ["4-6 relaterte spørsmål norske lesere stiller"],
 "sources": [{"title":"...","url":"https://...","publisher":"..."}]
}`;
}

// Quality validation — returns per-check results + score 0-100
function validate(out: any, intent: any) {
  const checks: Record<string, boolean> = {
    has_title: !!(out.title && out.title.length >= 15 && out.title.length <= 90),
    has_meta_title: !!(out.meta_title && out.meta_title.length <= 65),
    has_meta_description: !!(out.meta_description && out.meta_description.length >= 60 && out.meta_description.length <= 175),
    has_quick_answer: !!(out.quick_answer && out.quick_answer.split(/\s+/).length >= 25),
    has_key_facts: Array.isArray(out.key_facts) && out.key_facts.length >= 4,
    has_why: !!(out.why_it_matters && out.why_it_matters.split(/\s+/).length >= 40),
    has_expert: !!(out.expert_summary && out.expert_summary.split(/\s+/).length >= 60),
    has_content: !!(out.content && out.content.split(/\s+/).length >= 400),
    has_faq: Array.isArray(out.faq) && out.faq.length >= 3,
    has_sources: Array.isArray(out.sources) && out.sources.length >= 1,
    norwegian_hint: /( og | er | på | med | for | ikke | som )/i.test((out.content || "") + " " + (out.expert_summary || "")),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  const score = Math.round((passed / total) * 100);
  return { checks, score, passed, total, ok: score >= 80 };
}

async function buildInternalLinks(supabase: any, intent: any) {
  const sourceType = "intent";
  const sourceSlug = intent.target_slug;
  const links: any[] = [];

  // Cluster siblings
  if (intent.search_cluster) {
    const { data: sib } = await supabase.from("search_intents")
      .select("target_slug, keyword, is_pillar, priority_score")
      .eq("search_cluster", intent.search_cluster)
      .eq("content_status", "published")
      .neq("id", intent.id)
      .order("is_pillar", { ascending: false })
      .order("priority_score", { ascending: false })
      .limit(6);
    for (const s of sib || []) {
      links.push({
        source_type: sourceType, source_slug: sourceSlug,
        target_type: "intent", target_slug: s.target_slug,
        anchor: s.keyword, relevance_score: s.is_pillar ? 95 : 75,
      });
    }
  }

  // Topic + entity anchors
  if (intent.topic_id) {
    const { data: t } = await supabase.from("topics").select("slug,name").eq("id", intent.topic_id).maybeSingle();
    if (t) links.push({ source_type: sourceType, source_slug: sourceSlug, target_type: "topic", target_slug: t.slug, anchor: t.name, relevance_score: 85 });
  }
  if (intent.entity_id) {
    const { data: e } = await supabase.from("entities").select("slug,name").eq("id", intent.entity_id).maybeSingle();
    if (e) links.push({ source_type: sourceType, source_slug: sourceSlug, target_type: "entity", target_slug: e.slug, anchor: e.name, relevance_score: 85 });
  }
  if (intent.secondary_entity_id) {
    const { data: e } = await supabase.from("entities").select("slug,name").eq("id", intent.secondary_entity_id).maybeSingle();
    if (e) links.push({ source_type: sourceType, source_slug: sourceSlug, target_type: "entity", target_slug: e.slug, anchor: e.name, relevance_score: 80 });
  }

  // Related articles: canonical cluster membership only (never articles.category).
  const { data: rows } = intent.search_cluster
    ? await supabase.from("article_clusters").select("articles!inner(slug,title,published)")
        .eq("cluster_slug", intent.search_cluster).eq("articles.published", true)
        .order("score", { ascending: false }).limit(4)
    : { data: [] as any[] };
  const arts = (rows || []).map((r: any) => r.articles);
  for (const a of arts) {
    if (!a.slug) continue;
    links.push({
      source_type: sourceType, source_slug: sourceSlug,
      target_type: "article", target_slug: a.slug, anchor: a.title, relevance_score: 60,
    });
  }

  if (!links.length) return 0;
  const { error } = await supabase.from("internal_links")
    .upsert(links, { onConflict: "source_type,source_slug,target_type,target_slug", ignoreDuplicates: true });
  if (error) { console.error("links", error); return 0; }
  return links.length;
}

// Exact-slug collision on another surface — cheap guard before spending AI credits.
async function slugCollision(supabase: any, slug: string) {
  const [k, g, c] = await Promise.all([
    supabase.from("knowledge_pages").select("slug").eq("slug", slug).maybeSingle(),
    supabase.from("guides").select("slug").eq("slug", slug).maybeSingle(),
    supabase.from("comparison_pages").select("slug").eq("slug", slug).maybeSingle(),
  ]);
  if (k.data) return `knowledge:${slug}`;
  if (g.data) return `guide:${slug}`;
  if (c.data) return `comparison:${slug}`;
  return null;
}

function buildGeoBlocks(out: any) {
  return {
    tldr: out.tldr,
    quick_answer: out.quick_answer,
    key_facts: out.key_facts || [],
    why_it_matters: out.why_it_matters,
    expert_summary: out.expert_summary,
    faq: out.faq || [],
    related_questions: out.related_questions || [],
    sources: out.sources || [],
  };
}

function buildSchemas(out: any) {
  return {
    faqSchema: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: (out.faq || []).map((f: any) => ({
        "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    speakable: {
      "@context": "https://schema.org", "@type": "WebPage",
      speakable: { "@type": "SpeakableSpecification", cssSelector: [".quick-answer", ".tldr", "h1"] },
    },
  };
}

/**
 * Merge newly verified information into an already-published intent page instead of
 * publishing a duplicate. Regenerates TLDR, FAQ, speakable schema, citations and links.
 */
async function mergeIntoExisting(supabase: any, key: string, targetSlug: string, fresh: any) {
  const { data: existing } = await supabase.from("search_intents").select("*")
    .eq("target_slug", targetSlug).maybeSingle();
  if (!existing) return { merged: false, reason: "target not found" };

  const prompt = `Du oppdaterer en eksisterende norsk fagartikkel med ny, verifisert informasjon. Ikke gjenta innhold, ikke fjern korrekt eksisterende informasjon — flett sammen.

EKSISTERENDE SIDE (JSON):
${JSON.stringify({
    title: existing.meta?.title, summary: existing.meta?.summary,
    content: (existing.meta?.content || "").slice(0, 6000),
    geo: existing.geo_blocks,
  }).slice(0, 12000)}

NY INFORMASJON (JSON):
${JSON.stringify({
    title: fresh.title, summary: fresh.summary, content: (fresh.content || "").slice(0, 6000),
    key_facts: fresh.key_facts, faq: fresh.faq, sources: fresh.sources,
  }).slice(0, 12000)}

Returner oppdatert JSON med samme felter: title, meta_title, meta_description, summary, tldr, quick_answer, key_facts, why_it_matters, expert_summary, content (markdown), faq, related_questions, sources (kombinert og deduplisert kildeliste).`;

  const out = await aiJson(prompt, key);
  const { faqSchema, speakable } = buildSchemas(out);

  await supabase.from("search_intents").update({
    last_generated_at: new Date().toISOString(),
    last_validated_at: new Date().toISOString(),
    geo_blocks: buildGeoBlocks(out),
    meta: {
      ...(existing.meta || {}),
      title: out.title || existing.meta?.title,
      meta_title: out.meta_title,
      meta_description: out.meta_description,
      summary: out.summary,
      content: out.content,
      faq_schema: faqSchema,
      speakable_schema: speakable,
      merged_at: new Date().toISOString(),
      merge_count: Number(existing.meta?.merge_count || 0) + 1,
    },
  }).eq("id", existing.id);

  // Refresh embedding for the merged content
  try {
    const vec = await embed(`${out.title}\n\n${out.content}`, key);
    await supabase.from("search_intents")
      .update({ embedding: vec as any, embedded_at: new Date().toISOString() })
      .eq("id", existing.id);
  } catch (e) { console.error("merge embed", e); }

  const { data: refreshed } = await supabase.from("search_intents").select("*").eq("id", existing.id).maybeSingle();
  const links = refreshed ? await buildInternalLinks(supabase, refreshed) : 0;
  return { merged: true, target: targetSlug, links };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return unauthorized(corsHeaders);
  const key = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!) as unknown as DbClient;

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 3, 10);
    const ids: string[] | undefined = body.ids;
    const force = !!body.force;
    const dryRun = !!body.dry_run;

    let q = supabase.from("search_intents").select("*").in("content_status", ["pending", "queued"])
      .order("priority_score", { ascending: false }).limit(limit);
    if (ids?.length) q = supabase.from("search_intents").select("*").in("id", ids);

    const { data: intents } = await q;
    if (!intents?.length) {
      return new Response(JSON.stringify({ generated: 0, message: "Nothing to generate" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Shared evergreen guard before any AI generation; dry_run returns verdicts with no writes.
    const cache: { titles?: TitleEntry[] } = {};
    const guarded = new Map<string, GuardResult | { decision: string; barrier: string; reason: string; match: { type: string; ref: string; title: string } }>();
    for (const intent of intents) {
      const slug = str(intent.target_slug);
      const keyword = str(intent.keyword);
      const cluster = str(intent.search_cluster);
      const collision = await slugCollision(supabase, slug);
      const g = collision
        ? { decision: "SKIP_DUPLICATE", barrier: "slug_collision", reason: "slug exists in another table", match: { type: collision.split(":")[0], ref: collision.split(":")[1], title: collision } }
        : await evergreenGuard(supabase, key, { type: "intent", slug, title: keyword, text: keyword, topics: [cluster].filter(Boolean) }, { cache });
      guarded.set(str(intent.id), g);
    }
    if (dryRun) {
      return new Response(JSON.stringify({ dry_run: true, verdicts: intents.map((i) => ({ slug: str(i.target_slug), ...guarded.get(str(i.id)) })) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let generated = 0, errors = 0, duplicates = 0, merged = 0, rejected = 0, linksCreated = 0;
    const decisions: any[] = [];

    for (const intent of intents) {
      try {
        if (!force && intent.content_status === "published") continue;

        const collision = await slugCollision(supabase, intent.target_slug);
        if (collision && !force) {
          await supabase.from("search_intents").update({
            content_status: "skipped", duplicate_of: collision,
          }).eq("id", intent.id);
          await recordVerdict(supabase, {
            type: "intent", ref: intent.target_slug, title: intent.keyword, text: "",
          } as Candidate, {
            decision: "duplicate", score: 1, signals: null,
            match: { content_type: collision.split(":")[0], ref: collision.split(":")[1], title: collision, similarity: 1 },
            embedding: [], candidates: [],
          }, "skipped-slug-collision");
          duplicates++;
          decisions.push({ intent: intent.keyword, decision: "duplicate", match: collision });
          continue;
        }

        const g = guarded.get(intent.id);
        if (!force && g.decision !== "CREATE_NEW") {
          await logGuard(supabase, { type: "intent", slug: intent.target_slug, title: intent.keyword }, g, "blocked-pre-generation");
          if (g.decision === "SKIP_DUPLICATE") {
            await supabase.from("search_intents").update({ content_status: "skipped", duplicate_of: `${g.match?.type}:${g.match?.ref}` }).eq("id", intent.id);
            duplicates++;
          }
          decisions.push({ intent: intent.keyword, decision: g.decision, barrier: g.barrier, match: g.match?.ref ?? null });
          continue;
        }

        await supabase.from("search_intents").update({ content_status: "generating" }).eq("id", intent.id);

        const [topicRes, entityRes, secRes] = await Promise.all([
          intent.topic_id ? supabase.from("topics").select("name, slug, description").eq("id", intent.topic_id).maybeSingle() : Promise.resolve({ data: null }),
          intent.entity_id ? supabase.from("entities").select("name, slug, entity_type, description").eq("id", intent.entity_id).maybeSingle() : Promise.resolve({ data: null }),
          intent.secondary_entity_id ? supabase.from("entities").select("name, slug, entity_type").eq("id", intent.secondary_entity_id).maybeSingle() : Promise.resolve({ data: null }),
        ]);

        const out = await aiJson(buildPrompt(intent, {
          topic: topicRes.data, entity: entityRes.data, secondary: secRes.data,
        }), key);

        const validation = validate(out, intent);
        if (!validation.ok && !force) {
          await supabase.from("search_intents").update({
            content_status: "failed",
            quality_score: validation.score,
            last_validated_at: new Date().toISOString(),
            validation,
            meta: { ...(intent.meta || {}), last_error: `Validation failed (${validation.passed}/${validation.total})` },
          }).eq("id", intent.id);
          rejected++;
          continue;
        }

        // ---- Semantic Duplicate Detection V2 (on the generated content) ----
        const candidate: Candidate = {
          type: "intent",
          ref: intent.target_slug,
          title: out.title || intent.keyword,
          text: [out.summary, out.quick_answer, out.content].filter(Boolean).join("\n\n"),
          entities: [entityRes.data?.name, secRes.data?.name].filter(Boolean) as string[],
          topics: [topicRes.data?.name, intent.search_cluster].filter(Boolean) as string[],
          event: out.title,
          source_url: (out.sources || [])[0]?.url ?? null,
          canonical_url: null,
          published_at: new Date().toISOString(),
        };
        const verdict = await evaluateDuplicate(supabase, key, candidate);

        if (verdict.decision !== "unique" && !force) {
          const isIntentMatch = verdict.match?.content_type === "intent" && verdict.match.ref;
          if (verdict.decision === "merge" && isIntentMatch) {
            const res = await mergeIntoExisting(supabase, key, verdict.match!.ref, out);
            linksCreated += res.links || 0;
            await supabase.from("search_intents").update({
              content_status: "skipped",
              duplicate_of: `intent:${verdict.match!.ref}`,
              quality_score: validation.score,
              validation,
              last_validated_at: new Date().toISOString(),
            }).eq("id", intent.id);
            await recordVerdict(supabase, candidate, verdict, `merged-into:intent:${verdict.match!.ref}`);
            merged++;
            decisions.push({ intent: intent.keyword, decision: "merge", match: verdict.match, score: verdict.score });
          } else {
            await supabase.from("search_intents").update({
              content_status: "skipped",
              duplicate_of: `${verdict.match?.content_type}:${verdict.match?.ref}`,
              quality_score: validation.score,
              validation,
              last_validated_at: new Date().toISOString(),
            }).eq("id", intent.id);
            await recordVerdict(supabase, candidate, verdict, "blocked-semantic-duplicate");
            duplicates++;
            decisions.push({ intent: intent.keyword, decision: "duplicate", match: verdict.match, score: verdict.score });
          }
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }

        const { faqSchema, speakable } = buildSchemas(out);

        await supabase.from("search_intents").update({
          content_status: "published",
          last_generated_at: new Date().toISOString(),
          last_validated_at: new Date().toISOString(),
          quality_score: validation.score,
          validation,
          geo_blocks: buildGeoBlocks(out),
          embedding: verdict.embedding as any,
          embedded_at: new Date().toISOString(),
          meta: {
            ...intent.meta,
            title: out.title,
            meta_title: out.meta_title,
            meta_description: out.meta_description,
            summary: out.summary,
            content: out.content,
            faq_schema: faqSchema,
            speakable_schema: speakable,
            dupe_score: Number(verdict.score.toFixed(4)),
          },
        }).eq("id", intent.id);

        await recordVerdict(supabase, candidate, verdict, "published-new-page");
        decisions.push({ intent: intent.keyword, decision: "unique", score: verdict.score });

        // Re-fetch to have the fresh row (with published status) for link building
        const { data: fresh } = await supabase.from("search_intents").select("*").eq("id", intent.id).maybeSingle();
        if (fresh) linksCreated += await buildInternalLinks(supabase, fresh);

        generated++;
        await new Promise((r) => setTimeout(r, 3000));

      } catch (e: any) {
        console.error("intent", intent.target_slug, e);
        errors++;
        await supabase.from("search_intents").update({
          content_status: "failed",
          meta: { ...(intent.meta || {}), last_error: String(e?.message || e).slice(0, 500) },
        }).eq("id", intent.id);
      }
    }

    return new Response(JSON.stringify({ generated, errors, duplicates, merged, rejected, linksCreated, processed: intents.length, decisions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
