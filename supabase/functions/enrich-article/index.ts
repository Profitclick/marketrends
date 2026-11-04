// Candidate-constrained enrichment.
//
// Architecture (Phase 6.2D):
//   1. Retrieve canonical candidate nodes for the article
//      (exact/alias lexical matching + embedding-neighbour vocabulary).
//   2. Ask the AI to select, from that canonical vocabulary and against the
//      actual article text, which relations are genuinely supported.
//   3. Allow new nodes ONLY when the AI explicitly states no canonical node is
//      adequate, and only after a normalized-name collision check.
//   4. Embeddings are used for candidate retrieval/prioritization only. They are
//      never sufficient evidence to create an article->topic/entity relation.
//   5. Every call writes a telemetry row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-3-flash-preview";

const slugify = (s: string) =>
  s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[æå]/g, "a").replace(/ø/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** Mirrors public.normalize_node_name so collision checks agree with the DB. */
const normName = (s: string) =>
  (s || "").toLowerCase()
    .replace(/[æ]/g, "a").replace(/[ø]/g, "o").replace(/[å]/g, "a")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+(as|asa|inc|ltd|llc|plc|corp|corporation|group|holding)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

type Candidate = { node_type: string; id: string; name: string; ntype: string | null; source: string; score: number };

interface Selection {
  selected_entities: { id: string; mentions: number; is_primary: boolean }[];
  selected_topics: { id: string; relevance: number }[];
  new_entities: { name: string; type: string; mentions: number; is_primary: boolean; justification: string }[];
  new_topics: { name: string; relevance: number; justification: string }[];
}

const EMPTY: Selection = { selected_entities: [], selected_topics: [], new_entities: [], new_topics: [] };

async function selectWithAI(
  article: { title: string; content: string; category: string },
  candidates: Candidate[],
): Promise<{ selection: Selection; usage: any }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const entCands = candidates.filter((c) => c.node_type === "entity");
  const topCands = candidates.filter((c) => c.node_type === "topic");

  const vocab = [
    "KANONISKE ENTITETER (velg fra disse først):",
    ...entCands.map((c) => `- ${c.id} | ${c.name} | type=${c.ntype ?? "?"}`),
    "",
    "KANONISKE TEMAER (velg fra disse først):",
    ...topCands.map((c) => `- ${c.id} | ${c.name}`),
  ].join("\n");

  const text =
    `Tittel: ${article.title}\nKategori: ${article.category}\n\n${(article.content || "").slice(0, 6000)}` +
    `\n\n---\n${vocab}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "Du kobler norske finans-/teknologiartikler til et EKSISTERENDE kunnskapsgraf-vokabular. " +
            "Regler: (1) Velg alltid eksisterende kanoniske noder når de dekker det artikkelen faktisk omtaler — bruk nodens id. " +
            "(2) En relasjon skal kun opprettes når artikkelteksten selv støtter den; kandidatlisten er forslag, ikke bevis. " +
            "(3) Foreslå en ny node KUN når ingen kanonisk node er dekkende, og oppgi kort begrunnelse. " +
            "(4) Ikke foreslå nye noder som bare er skrivemåte-varianter av eksisterende noder. " +
            "(5) Ingen relasjoner er et gyldig svar.",
        },
        { role: "user", content: text },
      ],
      tools: [{
        type: "function",
        function: {
          name: "select_relations",
          description: "Select canonical nodes supported by the article; propose new nodes only if necessary.",
          parameters: {
            type: "object",
            properties: {
              selected_entities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    mentions: { type: "number" },
                    is_primary: { type: "boolean" },
                  },
                  required: ["id", "mentions", "is_primary"],
                  additionalProperties: false,
                },
              },
              selected_topics: {
                type: "array",
                items: {
                  type: "object",
                  properties: { id: { type: "string" }, relevance: { type: "number" } },
                  required: ["id", "relevance"],
                  additionalProperties: false,
                },
              },
              new_entities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { type: "string", enum: ["company", "person", "crypto", "tech", "product", "startup", "other"] },
                    mentions: { type: "number" },
                    is_primary: { type: "boolean" },
                    justification: { type: "string" },
                  },
                  required: ["name", "type", "mentions", "is_primary", "justification"],
                  additionalProperties: false,
                },
              },
              new_topics: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    relevance: { type: "number" },
                    justification: { type: "string" },
                  },
                  required: ["name", "relevance", "justification"],
                  additionalProperties: false,
                },
              },
            },
            required: ["selected_entities", "selected_topics", "new_entities", "new_topics"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "select_relations" } },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    // 402 = AI budget exhausted, 429 = rate limited. Neither says anything about
    // the article, so they must never consume the article's retry budget.
    if (res.status === 402 || res.status === 429) {
      throw new Error(`BUDGET_EXHAUSTED ${res.status}: ${t.slice(0, 200)}`);
    }
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = await res.json();
  const usage = data.usage ?? null;
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return { selection: EMPTY, usage };
  try {
    const p = JSON.parse(args);
    return {
      selection: {
        selected_entities: p.selected_entities || [],
        selected_topics: p.selected_topics || [],
        new_entities: p.new_entities || [],
        new_topics: p.new_topics || [],
      },
      usage,
    };
  } catch {
    return { selection: EMPTY, usage };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdmin(req);
  if (!auth.ok) return unauthorized(corsHeaders);

  const startedAt = Date.now();
  let articleId: string | undefined;
  let runId: string | null = null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const tel = {
    ai_calls: 0,
    ai_success: false,
    model: MODEL,
    candidates_offered: 0,
    canonical_entities_reused: 0,
    canonical_topics_reused: 0,
    new_entities_proposed: 0,
    new_topics_proposed: 0,
    new_entities_created: 0,
    new_topics_created: 0,
    entity_relations_created: 0,
    topic_relations_created: 0,
    singleton_nodes_created: 0,
    prompt_tokens: null as number | null,
    completion_tokens: null as number | null,
    total_tokens: null as number | null,
    credits: null as number | null,
  };

  const writeTelemetry = async (failure_reason?: string, details: Record<string, unknown> = {}) => {
    try {
      await supabase.from("enrichment_telemetry").insert({
        article_id: articleId ?? null,
        run_id: runId,
        mode: "candidate_constrained",
        failure_reason: failure_reason ?? null,
        processing_ms: Date.now() - startedAt,
        details,
        ...tel,
      });
    } catch (e) {
      console.error("telemetry insert failed", e);
    }
  };

  try {
    const body = await req.json();
    articleId = body.article_id;
    runId = body.run_id ?? null;
    if (!articleId) throw new Error("article_id required");

    const { data: article, error: artErr } = await supabase
      .from("articles")
      .select("id, title, content, category, tags, created_at, published")
      .eq("id", articleId)
      .maybeSingle();
    if (artErr) throw artErr;
    if (!article) throw new Error("article not found");

    // --- 1. Canonical candidate retrieval (no AI, no relations created) ---
    const { data: candData, error: candErr } = await supabase
      .rpc("candidate_nodes_for_article", { _article_id: articleId, _neighbours: 12, _limit: 60 });
    if (candErr) console.error("candidate retrieval", candErr.message);
    const candidates = (candData || []) as Candidate[];
    tel.candidates_offered = candidates.length;
    const candEntityIds = new Set(candidates.filter((c) => c.node_type === "entity").map((c) => c.id));
    const candTopicIds = new Set(candidates.filter((c) => c.node_type === "topic").map((c) => c.id));

    // --- 2. AI adjudication against the actual article content ---
    tel.ai_calls = 1;
    const { selection, usage } = await selectWithAI(article, candidates);
    tel.ai_success = true;
    if (usage) {
      tel.prompt_tokens = usage.prompt_tokens ?? null;
      tel.completion_tokens = usage.completion_tokens ?? null;
      tel.total_tokens = usage.total_tokens ?? null;
      tel.credits = usage.cost ?? usage.credits ?? null;
    }
    tel.new_entities_proposed = selection.new_entities.length;
    tel.new_topics_proposed = selection.new_topics.length;

    // --- 3. Resolve entities: reuse canonical first, create only when needed ---
    const entityRows: { entity_id: string; mention_count: number; is_primary: boolean }[] = [];
    for (const s of selection.selected_entities) {
      if (!candEntityIds.has(s.id)) continue; // hallucinated id -> ignored
      entityRows.push({
        entity_id: s.id,
        mention_count: Math.max(1, Math.round(s.mentions || 1)),
        is_primary: !!s.is_primary,
      });
      tel.canonical_entities_reused++;
    }

    // --- 3b. Entity governance (Phase 6.2F) -------------------------------
    // A proposed node only becomes canonical when it is a durable, materially
    // relevant entity WITH explicit textual evidence. Everything else is
    // rejected with a logged reason instead of fragmenting the vocabulary.
    const { data: stopRows } = await supabase.from("graph_stopterms").select("term");
    const stopTerms = new Set((stopRows || []).map((r: any) => String(r.term).toLowerCase()));

    const articleText = `${article.title}\n${article.content || ""}`.toLowerCase();
    const esc = (s: string) => s.replace(/[.^$*+?()[\]{}|\\-]/g, "\\$&");
    const mentionsOf = (name: string) => {
      try {
        const re = new RegExp(`(^|[^a-z0-9æøå])${esc(name.toLowerCase())}([^a-z0-9æøå]|$)`, "g");
        return (articleText.match(re) || []).length;
      } catch { return 0; }
    };

    // Types that can represent a durable organisation / asset / institution.
    const DURABLE = new Set(["company", "crypto", "startup", "tech"]);
    // Types that are only durable with repeated, material coverage.
    const CONDITIONAL = new Set(["person", "product"]);

    const rejections: { name: string; type: string; reason: string }[] = [];
    const govern = { proposed: 0, accepted: 0, rejected: 0, stopterm: 0, collision: 0 };

    for (const ne of selection.new_entities) {
      govern.proposed++;
      const rawName = (ne.name || "").trim();
      const nn = normName(rawName);
      const slug = slugify(rawName);
      const reject = (reason: string) => {
        govern.rejected++;
        rejections.push({ name: rawName, type: ne.type, reason });
      };

      if (!nn || !slug || rawName.length < 3) { reject("too_short_or_unslugifiable"); continue; }
      if (stopTerms.has(rawName.toLowerCase()) || stopTerms.has(nn)) {
        govern.stopterm++; reject("stop_term_or_generic_descriptor"); continue;
      }
      if (/^[\d\s.,%+-]+$/.test(rawName)) { reject("numeric_or_non_entity"); continue; }

      const mentions = mentionsOf(rawName);
      if (mentions < 1) { reject("no_explicit_text_evidence"); continue; }

      // 1-6. canonical / alias / normalized-name / collision lookups
      const { data: hit } = await supabase
        .from("entities").select("id").eq("slug", slug).maybeSingle();
      let id = hit?.id as string | undefined;
      if (!id) {
        const { data: norm } = await supabase.rpc("find_entity_by_normalized_name", { _name: rawName });
        id = (norm as any)?.[0]?.id ?? (typeof norm === "string" ? norm : undefined);
      }
      if (!id) {
        const { data: aliasHit } = await supabase
          .from("entities").select("id").contains("aliases", [rawName]).maybeSingle();
        id = aliasHit?.id as string | undefined;
      }
      if (!id) {
        const local = candidates.find(
          (c) => c.node_type === "entity" && normName(c.name) === nn,
        );
        id = local?.id;
      }

      if (id) {
        govern.collision++;
        tel.canonical_entities_reused++;
      } else {
        // 7. durability gate — only now may a new canonical node be created.
        if (!DURABLE.has(ne.type) && !CONDITIONAL.has(ne.type)) {
          reject(`non_durable_type:${ne.type}`); continue;
        }
        if (CONDITIONAL.has(ne.type) && !(mentions >= 2 && ne.is_primary !== false)) {
          reject(`conditional_type_insufficient_material_relevance:${ne.type}`); continue;
        }
        const { data: ins } = await supabase.from("entities")
          .insert({ slug, name: rawName, type: ne.type, aliases: [rawName] })
          .select("id").single();
        id = ins?.id;
        if (id) { govern.accepted++; tel.new_entities_created++; tel.singleton_nodes_created++; }
        else { reject("insert_failed"); continue; }
      }

      if (id && !entityRows.some((r) => r.entity_id === id)) {
        entityRows.push({
          entity_id: id,
          mention_count: Math.max(1, mentions || Math.round(ne.mentions || 1)),
          is_primary: !!ne.is_primary,
        });
      }
    }


    await supabase.from("article_entities").delete().eq("article_id", articleId);
    if (entityRows.length) {
      const { error: aeErr } = await supabase.from("article_entities")
        .insert(entityRows.map((r) => ({ article_id: articleId, ...r })));
      if (aeErr) console.error("article_entities insert", aeErr.message);
      else tel.entity_relations_created = entityRows.length;

      const nowIso = new Date().toISOString();
      for (const r of entityRows) {
        const { data: cur } = await supabase
          .from("entities").select("mention_count").eq("id", r.entity_id).maybeSingle();
        await supabase.from("entities").update({
          mention_count: (cur?.mention_count || 0) + r.mention_count,
          last_mention_at: nowIso,
        }).eq("id", r.entity_id);
      }
    }

    // --- 4. Resolve topics with the same discipline ---
    const topicRows: { topic_id: string; relevance_score: number }[] = [];
    const clampRel = (v: number) => Math.min(1, Math.max(0, v || 0.5));

    for (const s of selection.selected_topics) {
      if (!candTopicIds.has(s.id)) continue;
      topicRows.push({ topic_id: s.id, relevance_score: clampRel(s.relevance) });
      tel.canonical_topics_reused++;
    }

    for (const nt of selection.new_topics) {
      const slug = slugify(nt.name);
      if (!slug) continue;
      const { data: hit } = await supabase
        .from("topics").select("id").eq("slug", slug).maybeSingle();
      let id = hit?.id as string | undefined;
      if (!id) {
        const { data: norm } = await supabase.rpc("find_topic_by_normalized_name", { _name: nt.name });
        id = (norm as any)?.[0]?.id ?? (typeof norm === "string" ? norm : undefined);
      }
      if (id) {
        tel.canonical_topics_reused++;
      } else {
        const { data: ins } = await supabase.from("topics").insert({
          slug,
          name: nt.name,
          description: `Siste nytt og analyser om ${nt.name} fra Marketrends.no.`,
          category_hint: article.category,
          meta_title: `${nt.name} – nyheter og analyse | Marketrends.no`,
          meta_description: `Følg ${nt.name} med daglige nyheter, analyser og forklaringer fra Marketrends.no.`,
        }).select("id").single();
        id = ins?.id;
        if (id) { tel.new_topics_created++; tel.singleton_nodes_created++; }
      }
      if (id && !topicRows.some((r) => r.topic_id === id)) {
        topicRows.push({ topic_id: id, relevance_score: clampRel(nt.relevance) });
      }
    }

    await supabase.from("article_topics").delete().eq("article_id", articleId);
    if (topicRows.length) {
      const { error: atErr } = await supabase.from("article_topics")
        .insert(topicRows.map((r) => ({ article_id: articleId, ...r })));
      if (atErr) console.error("article_topics insert", atErr.message);
      else tel.topic_relations_created = topicRows.length;
    }

    // --- 5. Related articles (unchanged scoring) ---
    const { data: candidatesArts } = await supabase
      .from("articles")
      .select("id, category, created_at, published")
      .eq("published", true)
      .neq("id", articleId)
      .order("created_at", { ascending: false })
      .limit(300);

    const candIds = (candidatesArts || []).map((c) => c.id);
    const topicMap = new Map<string, Set<string>>();
    const entityMap = new Map<string, Set<string>>();

    if (candIds.length) {
      const { data: at } = await supabase
        .from("article_topics").select("article_id, topic_id").in("article_id", candIds);
      for (const r of at || []) {
        if (!topicMap.has(r.article_id)) topicMap.set(r.article_id, new Set());
        topicMap.get(r.article_id)!.add(r.topic_id);
      }
      const { data: ae } = await supabase
        .from("article_entities").select("article_id, entity_id").in("article_id", candIds);
      for (const r of ae || []) {
        if (!entityMap.has(r.article_id)) entityMap.set(r.article_id, new Set());
        entityMap.get(r.article_id)!.add(r.entity_id);
      }
    }

    const myTopics = new Set(topicRows.map((t) => t.topic_id));
    const myEntities = new Set(entityRows.map((e) => e.entity_id));
    const now = Date.now();

    const scored = (candidatesArts || []).map((c) => {
      const ct = topicMap.get(c.id) || new Set();
      const ce = entityMap.get(c.id) || new Set();
      let sharedTopics = 0; for (const t of myTopics) if (ct.has(t)) sharedTopics++;
      let sharedEntities = 0; for (const e of myEntities) if (ce.has(e)) sharedEntities++;
      const ageHours = (now - new Date(c.created_at).getTime()) / 36e5;
      const fresh = Math.max(0, 2 - ageHours / 168);
      const score = 3 * sharedTopics + 2 * sharedEntities + (c.category === article.category ? 1 : 0) + fresh;
      return { id: c.id, score, type: sharedTopics > 0 ? "topic" : sharedEntities > 0 ? "entity" : "category" };
    }).filter((x) => x.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    await supabase.from("article_relations").delete().eq("article_id", articleId);
    if (scored.length) {
      await supabase.from("article_relations").insert(
        scored.map((s) => ({
          article_id: articleId,
          related_article_id: s.id,
          similarity_score: s.score,
          relation_type: s.type,
        })),
      );
    }

    // --- 6. Idempotent status bookkeeping ---
    const hasRelations = entityRows.length > 0 || topicRows.length > 0;
    await supabase.from("articles").update({
      enrichment_status: hasRelations ? "complete_with_relations" : "complete_no_relations",
      last_enriched_at: new Date().toISOString(),
      enrich_failure_reason: null,
    }).eq("id", articleId);

    const reuseTotal = tel.canonical_entities_reused + tel.canonical_topics_reused;
    const createdTotal = tel.new_entities_created + tel.new_topics_created;
    await writeTelemetry(undefined, {
      reuse_rate: reuseTotal + createdTotal === 0 ? null : reuseTotal / (reuseTotal + createdTotal),
      relations_total: tel.entity_relations_created + tel.topic_relations_created,
      article_relations: scored.length,
      entity_governance: govern,
      rejected_new_entities: rejections,
    });


    return new Response(JSON.stringify({
      ok: true,
      entities: entityRows.length,
      topics: topicRows.length,
      relations: scored.length,
      telemetry: tel,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("enrich-article error", e);
    const msg = e instanceof Error ? e.message : String(e);
    const budget = msg.startsWith("BUDGET_EXHAUSTED");
    await writeTelemetry(msg.slice(0, 500), { budget_exhausted: budget });
    if (articleId && !budget) {
      const { data: cur } = await supabase.from("articles")
        .select("enrich_retry_count").eq("id", articleId).maybeSingle();
      const retries = (cur?.enrich_retry_count ?? 0) + 1;
      await supabase.from("articles").update({
        enrich_retry_count: retries,
        enrichment_status: retries >= 5 ? "failed" : "retry",
        enrich_failure_reason: msg.slice(0, 500),
        last_enriched_at: new Date().toISOString(),
      }).eq("id", articleId);
    }
    // Budget/rate errors leave the row untouched in the queue and surface 402
    // so the caller can stop the whole run instead of burning the backlog.
    return new Response(JSON.stringify({ error: msg, budget_exhausted: budget }), {
      status: budget ? 402 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
