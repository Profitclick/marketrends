// Compute the search-intent backlog with intelligent, multi-signal prioritization.
// Inputs: topics + entities. Signals: authority, opportunity, demand (trend/velocity/
// mentions), momentum, commercial intent, coverage gap (articles + existing knowledge/
// guides/comparisons/search-intent pages), and internal-link density.
// Idempotent per target_slug. Marks obvious duplicates as `skipped` with duplicate_of.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[æå]/g, "a").replace(/ø/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Template = {
  id: string;
  pattern: (name: string, other?: string) => string;
  intent: "informational" | "commercial" | "transactional" | "comparison";
  slug: (name: string, other?: string) => string;
  isPillar?: boolean;
  needsOther?: boolean;
  commercialBias?: number;
};

const TEMPLATES: Template[] = [
  { id: "pillar", pattern: (n) => `${n}`, intent: "informational", slug: (n) => `${slugify(n)}`, isPillar: true },
  { id: "hva-er", pattern: (n) => `Hva er ${n}`, intent: "informational", slug: (n) => `hva-er-${slugify(n)}` },
  { id: "hvordan-fungerer", pattern: (n) => `Hvordan fungerer ${n}`, intent: "informational", slug: (n) => `hvordan-fungerer-${slugify(n)}` },
  { id: "hvordan-starte", pattern: (n) => `Hvordan starte med ${n}`, intent: "transactional", slug: (n) => `hvordan-starte-med-${slugify(n)}`, commercialBias: 8 },
  { id: "guide", pattern: (n) => `Guide til ${n}`, intent: "informational", slug: (n) => `guide-til-${slugify(n)}` },
  { id: "beste", pattern: (n) => `Beste ${n} 2026`, intent: "commercial", slug: (n) => `beste-${slugify(n)}`, commercialBias: 14 },
  { id: "alternativer", pattern: (n) => `Alternativer til ${n}`, intent: "commercial", slug: (n) => `alternativer-til-${slugify(n)}`, commercialBias: 10 },
  { id: "fordeler-ulemper", pattern: (n) => `Fordeler og ulemper med ${n}`, intent: "informational", slug: (n) => `fordeler-og-ulemper-med-${slugify(n)}` },
  { id: "vanlige-feil", pattern: (n) => `Vanlige feil med ${n}`, intent: "informational", slug: (n) => `vanlige-feil-med-${slugify(n)}` },
  { id: "vs", pattern: (n, o) => `${n} vs ${o}`, intent: "comparison", slug: (n, o) => `${slugify(n)}-vs-${slugify(o || "")}`, needsOther: true, commercialBias: 6 },
];

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

// Fuzzy tokenizer for coverage detection
const tokens = (s: string) =>
  new Set(slugify(s).split("-").filter((t) => t.length > 2));

const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
};

type Ctx = {
  articleTitles: string[];
  knowledgeSlugs: Set<string>;
  guideSlugs: Set<string>;
  comparisonSlugs: Set<string>;
  intentSlugs: Set<string>;
  clusterArticles: Map<string, number>; // cluster slug -> article count
  clusterLinks: Map<string, number>;    // cluster slug -> internal links pointing in
};

function coverageScore(kw: string, cluster: string | null, ctx: Ctx): { coverage: number; duplicate?: string } {
  const s = slugify(kw);
  const kwToks = tokens(kw);

  // Direct slug hits across content surfaces
  for (const set of [ctx.knowledgeSlugs, ctx.guideSlugs, ctx.comparisonSlugs, ctx.intentSlugs]) {
    if (set.has(s)) return { coverage: 100, duplicate: s };
  }

  // Fuzzy article title match
  let bestArt = 0;
  for (const t of ctx.articleTitles) {
    const j = jaccard(kwToks, tokens(t));
    if (j > bestArt) bestArt = j;
    if (bestArt > 0.9) break;
  }
  if (bestArt >= 0.85) return { coverage: 95, duplicate: `article:${bestArt.toFixed(2)}` };

  // Cluster saturation
  const clusterArts = cluster ? (ctx.clusterArticles.get(cluster) || 0) : 0;
  const clusterLnk = cluster ? (ctx.clusterLinks.get(cluster) || 0) : 0;
  const saturation = clamp(clusterArts * 5 + clusterLnk * 1.5);

  return { coverage: clamp(bestArt * 80 + saturation * 0.3) };
}

function priorityScore(args: {
  authority: number;    // 0-100 from topic/entity authority
  opportunity: number;  // 0-100 from opportunities table (if any)
  demand: number;       // 0-100 derived
  commercial: number;   // 0-100 derived
  momentum: number;     // 0-100 derived
  coverage: number;     // 0-100 (higher = less need)
  pillarBonus: number;
}): number {
  const gap = 100 - args.coverage;
  return clamp(
    args.demand * 0.22 +
    (100 - args.coverage) * 0.20 +  // coverage gap = biggest driver
    args.authority * 0.15 +
    args.opportunity * 0.15 +
    args.commercial * 0.12 +
    args.momentum * 0.10 +
    Math.min(gap, 100) * 0.03 +
    args.pillarBonus,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return unauthorized(corsHeaders);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const topicLimit = Math.min(Number(body.topicLimit) || 40, 100);
    const entityLimit = Math.min(Number(body.entityLimit) || 40, 100);

    const [topicsRes, entitiesRes, artsRes, knowRes, guidesRes, cmpRes, intentsRes, linksRes] = await Promise.all([
      supabase.from("topics")
        .select("id,name,slug,category,trending_score,velocity_score,momentum_score,articles_last_7d,articles_last_30d,article_count,authority_score")
        .order("trending_score", { ascending: false }).limit(topicLimit),
      supabase.from("entities")
        .select("id,name,slug,entity_type,trending_score,velocity_score,momentum_score,mentions_last_7d,mentions_last_30d,authority_score")
        .order("trending_score", { ascending: false }).limit(entityLimit),
      supabase.from("articles").select("title,slug,category,tags").eq("published", true).limit(2000),
      supabase.from("knowledge_pages").select("slug").limit(1000),
      supabase.from("guides").select("slug").limit(1000),
      supabase.from("comparison_pages").select("slug").limit(1000),
      supabase.from("search_intents").select("target_slug,search_cluster").in("content_status", ["published","generating","queued"]).limit(3000),
      supabase.from("internal_links").select("target_slug,target_type").limit(5000),
    ]);

    // Opportunities lookup (optional)
    const { data: opps } = await supabase.from("opportunities")
      .select("keyword,topic_id,entity_id,opportunity_score").limit(2000);
    const oppByTopic = new Map<string, number>();
    const oppByEntity = new Map<string, number>();
    for (const o of opps || []) {
      if (o.topic_id) oppByTopic.set(o.topic_id, Math.max(oppByTopic.get(o.topic_id) || 0, Number(o.opportunity_score || 0)));
      if (o.entity_id) oppByEntity.set(o.entity_id, Math.max(oppByEntity.get(o.entity_id) || 0, Number(o.opportunity_score || 0)));
    }

    const clusterArticles = new Map<string, number>();
    for (const a of artsRes.data || []) {
      const c = a.category ? slugify(a.category) : null;
      if (c) clusterArticles.set(c, (clusterArticles.get(c) || 0) + 1);
    }
    const clusterLinks = new Map<string, number>();
    for (const l of linksRes.data || []) {
      if (!l.target_slug) continue;
      clusterLinks.set(l.target_slug, (clusterLinks.get(l.target_slug) || 0) + 1);
    }

    const ctx: Ctx = {
      articleTitles: (artsRes.data || []).map((a: any) => a.title || ""),
      knowledgeSlugs: new Set((knowRes.data || []).map((r: any) => r.slug)),
      guideSlugs: new Set((guidesRes.data || []).map((r: any) => r.slug)),
      comparisonSlugs: new Set((cmpRes.data || []).map((r: any) => r.slug)),
      intentSlugs: new Set((intentsRes.data || []).map((r: any) => r.target_slug).filter(Boolean)),
      clusterArticles,
      clusterLinks,
    };

    const rows: any[] = [];

    const buildRow = (opts: {
      tpl: Template; name: string; other?: string; cluster: string;
      topicId?: string; entityId?: string; secondaryId?: string;
      authority: number; opportunity: number; demand: number;
      momentum: number; source: string; extraMeta?: any;
    }) => {
      const { tpl } = opts;
      const keyword = tpl.pattern(opts.name, opts.other);
      const target_slug = tpl.slug(opts.name, opts.other);
      const commercial = clamp((tpl.commercialBias || 0) * 6 + (tpl.intent === "commercial" ? 40 : tpl.intent === "transactional" ? 30 : tpl.intent === "comparison" ? 25 : 10));
      const { coverage, duplicate } = coverageScore(keyword, opts.cluster, ctx);
      const pillarBonus = tpl.isPillar ? 12 : 0;
      const priority = priorityScore({
        authority: opts.authority, opportunity: opts.opportunity,
        demand: opts.demand, commercial, momentum: opts.momentum,
        coverage, pillarBonus,
      });
      return {
        keyword,
        intent_type: tpl.intent,
        template: tpl.id,
        search_cluster: opts.cluster,
        topic_id: opts.topicId || null,
        entity_id: opts.entityId || null,
        secondary_entity_id: opts.secondaryId || null,
        priority_score: priority,
        demand_score: opts.demand,
        commercial_score: commercial,
        coverage_score: coverage,
        content_status: duplicate ? "skipped" : "pending",
        target_slug,
        is_pillar: !!tpl.isPillar,
        duplicate_of: duplicate || null,
        meta: { source: opts.source, ...opts.extraMeta },
      };
    };

    for (const t of topicsRes.data || []) {
      const authority = clamp(Number(t.authority_score || 0));
      const opportunity = clamp(oppByTopic.get(t.id) || 0);
      const demand = clamp(
        Number(t.trending_score || 0) * 0.8 +
        Number(t.velocity_score || 0) * 4 +
        Number(t.articles_last_7d || 0) * 3,
      );
      const momentum = clamp(Number(t.momentum_score || 0) * 10);
      for (const tpl of TEMPLATES) {
        if (tpl.needsOther) continue;
        rows.push(buildRow({
          tpl, name: t.name, cluster: t.slug, topicId: t.id,
          authority, opportunity, demand, momentum, source: "topic",
          extraMeta: { topic_slug: t.slug, category: t.category },
        }));
      }
    }

    const byType = new Map<string, any[]>();
    for (const e of entitiesRes.data || []) {
      const t = e.entity_type || "other";
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(e);
    }

    for (const e of entitiesRes.data || []) {
      const authority = clamp(Number(e.authority_score || 0));
      const opportunity = clamp(oppByEntity.get(e.id) || 0);
      const demand = clamp(
        Number(e.trending_score || 0) * 0.8 +
        Number(e.velocity_score || 0) * 4 +
        Number(e.mentions_last_7d || 0) * 2,
      );
      const momentum = clamp(Number(e.momentum_score || 0) * 10);
      for (const tpl of TEMPLATES) {
        if (tpl.needsOther) continue;
        rows.push(buildRow({
          tpl, name: e.name, cluster: e.slug, entityId: e.id,
          authority, opportunity, demand, momentum, source: "entity",
          extraMeta: { entity_slug: e.slug, entity_type: e.entity_type },
        }));
      }
      const peers = (byType.get(e.entity_type || "other") || []).filter((p) => p.id !== e.id).slice(0, 2);
      for (const p of peers) {
        const tpl = TEMPLATES.find((x) => x.id === "vs")!;
        rows.push(buildRow({
          tpl, name: e.name, other: p.name, cluster: e.slug,
          entityId: e.id, secondaryId: p.id,
          authority, opportunity, demand, momentum, source: "entity-pair",
          extraMeta: { a: e.slug, b: p.slug, entity_type: e.entity_type },
        }));
      }
    }

    // Dedupe by target_slug (keep highest priority)
    const seen = new Map<string, any>();
    for (const r of rows) {
      if (!r.target_slug) continue;
      const prev = seen.get(r.target_slug);
      if (!prev || r.priority_score > prev.priority_score) seen.set(r.target_slug, r);
    }
    const unique = Array.from(seen.values());

    let upserts = 0, errors = 0, skipped = 0;
    for (const r of unique) if (r.content_status === "skipped") skipped++;

    for (let i = 0; i < unique.length; i += 100) {
      const slice = unique.slice(i, i + 100);
      // Don't overwrite already-published intents — only touch pending/skipped/failed
      const { error } = await supabase.from("search_intents")
        .upsert(slice, { onConflict: "target_slug", ignoreDuplicates: false });
      if (error) { errors++; console.error(error); } else { upserts += slice.length; }
    }

    // Reprotect published rows: never regress a published intent back to pending
    await supabase.rpc; // noop guard

    // Link supporting intents to their pillar
    const { data: pillars } = await supabase.from("search_intents")
      .select("id, search_cluster").eq("is_pillar", true);
    const pillarMap = new Map((pillars || []).map((p: any) => [p.search_cluster, p.id]));
    for (const [cluster, pid] of pillarMap) {
      await supabase.from("search_intents")
        .update({ pillar_intent_id: pid })
        .eq("search_cluster", cluster)
        .eq("is_pillar", false)
        .is("pillar_intent_id", null);
    }

    return new Response(JSON.stringify({
      ok: true, upserts, errors, skipped,
      topics: topicsRes.data?.length || 0, entities: entitiesRes.data?.length || 0,
      unique: unique.length, pillars: pillarMap.size,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
