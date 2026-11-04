/**
 * project-context – Dynamic LLM context endpoint for Marketrends
 *
 * Returns a plain-text Markdown document that combines:
 *   • Static architecture / spec documentation (always accurate)
 *   • Live database stats (article counts, feed status, recent articles)
 *
 * Constant URL:
 *   https://jsfzdlgfxvnlosrsafjw.supabase.co/functions/v1/project-context
 *
 * Usage with an LLM:
 *   "Here is the full context for the Marketrends project:
 *    https://jsfzdlgfxvnlosrsafjw.supabase.co/functions/v1/project-context"
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://marketrends.no";
const SUPABASE_PROJECT_ID = "jsfzdlgfxvnlosrsafjw";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    return new Response("Server misconfiguration: missing Supabase env vars.", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── Live database queries ──────────────────────────────────────────────────

  const [
    { count: totalCount },
    { count: publishedCount },
    { data: aiStatusRows },
    { data: categoryRows },
    { data: recentArticles },
    { data: feedRows },
  ] = await Promise.all([
    supabase.from("articles").select("id", { count: "exact", head: true }),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("published", true),
    supabase.from("articles").select("ai_status"),
    supabase
      .from("articles")
      .select("category")
      .eq("published", true),
    supabase
      .from("articles")
      .select("title, category, created_at, source_name")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("rss_feeds").select("name, active, last_fetched_at"),
  ]);

  // Aggregate ai_status counts
  const aiStatusMap: Record<string, number> = {};
  for (const row of aiStatusRows ?? []) {
    const s = row.ai_status ?? "null";
    aiStatusMap[s] = (aiStatusMap[s] ?? 0) + 1;
  }

  // Aggregate per-category published counts
  const catMap: Record<string, number> = {};
  for (const row of categoryRows ?? []) {
    catMap[row.category] = (catMap[row.category] ?? 0) + 1;
  }

  const activeFeeds = (feedRows ?? []).filter((f) => f.active).length;
  const totalFeeds = (feedRows ?? []).length;

  // Format last-fetched for display
  const lastFetch =
    (feedRows ?? [])
      .filter((f) => f.last_fetched_at)
      .map((f) => new Date(f.last_fetched_at).getTime())
      .sort((a, b) => b - a)[0] ?? null;

  const lastFetchStr = lastFetch
    ? new Date(lastFetch).toISOString()
    : "unknown";

  // ── Build Markdown document ────────────────────────────────────────────────

  const now = new Date().toISOString();

  const categoryTable = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, cnt]) => `| ${cat} | ${cnt} |`)
    .join("\n");

  const aiStatusTable = Object.entries(aiStatusMap)
    .sort((a, b) => b[1] - a[1])
    .map(([status, cnt]) => `| ${status} | ${cnt} |`)
    .join("\n");

  const recentList = (recentArticles ?? [])
    .map(
      (a) =>
        `- [${a.category}] "${a.title}" (${a.source_name}, ${a.created_at?.substring(0, 10)})`
    )
    .join("\n");

  const feedList = (feedRows ?? [])
    .map(
      (f) =>
        `| ${f.name} | ${f.active ? "✅ active" : "❌ inactive"} | ${f.last_fetched_at ? f.last_fetched_at.substring(0, 19).replace("T", " ") : "never"} |`
    )
    .join("\n");

  const doc = `# Marketrends – Full Project Context
*Generated: ${now}*
*Context endpoint: https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/project-context*

---

## 1. Project Overview

**Marketrends** is a Norwegian AI-powered news aggregation platform focused on finance,
technology, crypto, and market trends. It aggregates content from 20+ international RSS feeds,
processes each article with an AI pipeline (OpenRouter / Claude / Mistral), and publishes
SEO-optimised Norwegian-language articles automatically.

- **Live URL**: ${SITE_URL}
- **Lovable project**: https://lovable.dev/projects/ed73ad9f-43df-4ba1-986e-155671257f39
- **Supabase project**: https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}
- **Repository**: https://github.com/openorway/marketrends

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| UI components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS v3 |
| Routing | React Router v6 |
| Data fetching | TanStack Query v5 |
| Backend / DB | Supabase (PostgreSQL + Edge Functions) |
| Edge runtime | Deno (Supabase Edge Functions) |
| Hosting | Lovable.dev (auto-deploy from GitHub) |

---

## 3. Architecture

\`\`\`
RSS Feeds (20+)
     │
     ▼
pg_cron (every 30 min)
     │ invokes
     ▼
fetch-and-process-feeds (Edge Function)
     │ pre-AI scores each item (threshold 0.40)
     │ sends top candidates to OpenRouter AI
     │ auto-publishes if ai_quality_score ≥ 0.75
     ▼
articles table (PostgreSQL)
     │
     ├── React frontend (SSR-free SPA)
     │       ├── / (homepage – NewsView)
     │       ├── /:slug (article page – NewsView)
     │       ├── /kategori/:slug (CategoryPage)
     │       ├── /om-oss (About)
     │       ├── /dashboard (Dashboard – admin stats)
     │       └── /admin (Index – feed management)
     │
     ├── export-rss (Edge Function) → /functions/v1/export-rss?format=rss|json
     ├── news-sitemap (Edge Function) → /functions/v1/news-sitemap
     ├── affiliate-redirect (Edge Function) → /functions/v1/affiliate-redirect
     ├── ingest-open-data (Edge Function) → manual data imports
     └── project-context (Edge Function) → this document
\`\`\`

---

## 4. Database Schema (key tables)

### articles
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto |
| title | text | AI-generated Norwegian title |
| slug | text | URL slug |
| content | text | Full article body (markdown) |
| meta_description | text | SEO description |
| category | text | One of 7 categories |
| source_name | text | Origin feed name |
| source_url | text | Original article URL |
| image_url | text | Hero image |
| tags | text[] | AI-assigned tags |
| article_type | text | news / analysis / guide / explainer |
| ai_status | text | pending / published / waiting_for_ai / failed |
| ai_quality_score | float | 0–1 (auto-publish ≥ 0.75) |
| published | boolean | visible on site |
| is_affiliate | boolean | contains affiliate links |
| created_at | timestamptz | |
| updated_at | timestamptz | trigger-maintained |

### rss_feeds
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Display name |
| url | text | RSS feed URL |
| active | boolean | enable/disable per feed |
| last_fetched_at | timestamptz | updated each cron run |
| fetch_count | int | total successful fetches |
| error_count | int | consecutive error count |

### affiliate_partners / affiliate_clicks
Tracks partner links embedded in articles and click-through analytics.

---

## 5. Content Categories

| Category | Description |
|----------|-------------|
| Krypto & Trading | Cryptocurrency, DeFi, trading |
| Teknologi & AI | Tech industry, AI, software |
| Finans & Marked | Stock markets, finance, economy |
| Gründer & Startups | Startup ecosystem, VC funding |
| Penger & Karriere | Personal finance, career |
| Trender & Analyse | Market trends, macro analysis |
| Guider & Forklart | How-to guides, explainers |

---

## 6. AI Pipeline Details

### Pre-AI Scoring (prevents token waste)
Each RSS item is scored before sending to the AI:

\`\`\`
+0.25  source is tier-1 (Reuters, AP, CNBC, CoinDesk, TechCrunch, Digi, TU, Bloomberg)
+0.15  source is tier-2 (Google News, The Verge, Wired, MarketWatch, VentureBeat, Ars Technica)
+0.10  source is tier-3 (others)
+0.20  title contains high-value keywords (AI, billion, crash, launch, hack, record, IPO, etc.)
+0.10  title length 40–80 chars (SEO-optimal)
+0.15  published < 6 hours ago
+0.05  published < 24 hours ago
+0.15  cross-source trending (same topic in 2+ feeds)

Threshold: only sent to AI if score ≥ 0.40
Auto-publish: if ai_quality_score ≥ 0.75
\`\`\`

### Pipeline limits per cron run
- Max articles processed: 8
- Max feeds scanned: 7
- Retry on 429: up to 3× with exponential backoff
- On 402 (credits exhausted): log and skip, do NOT insert stub articles

---

## 7. Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| fetch-and-process-feeds | pg_cron every 30 min | RSS ingestion + AI rewrite |
| export-rss | HTTP GET | RSS 2.0 / JSON Feed export |
| news-sitemap | HTTP GET | Google News XML sitemap |
| affiliate-redirect | HTTP GET | Tracked affiliate click redirect |
| ingest-open-data | HTTP POST (manual) | Manual data import |
| project-context | HTTP GET | **This document** – LLM context |

---

## 8. Feed Sources (${activeFeeds}/${totalFeeds} active)

| Feed | Status | Last Fetched |
|------|--------|-------------|
${feedList || "_(no feed data available)_"}

---

## 9. Live Database Stats
*Snapshot at ${now}*

### Article counts by AI status
| ai_status | count |
|-----------|-------|
${aiStatusTable || "_(no data)_"}

**Total articles**: ${totalCount ?? "?"}
**Published articles**: ${publishedCount ?? "?"}

### Published articles by category
| Category | Published |
|----------|-----------|
${categoryTable || "_(no data)_"}

---

## 10. 10 Most Recent Published Articles

${recentList || "_(no published articles)_"}

---

## 11. SEO & URLs

- **Canonical base**: ${SITE_URL}
- **Sitemap index**: ${SITE_URL}/sitemap-index.xml
- **News sitemap**: ${SITE_URL}/sitemap.xml
- **RSS feed**: https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/export-rss?format=rss
- **JSON feed**: https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/export-rss?format=json
- **robots.txt**: ${SITE_URL}/robots.txt
- **Language**: Norwegian (nb-NO) primary

---

## 12. Key Files & Directories

\`\`\`
src/
├── pages/          React page components (Index, NewsView, CategoryPage, About, Dashboard)
├── components/     Reusable UI components (Navigation, ArticleContent, SEOHead, etc.)
├── config/
│   └── feeds.ts    Static feed config + CATEGORIES constant + getFeedsForBatch()
├── utils/
│   ├── seo.ts      Canonical URL helpers
│   └── authors.ts  Pseudo-author assignment
├── integrations/
│   └── supabase/
│       ├── client.ts   Supabase JS client
│       └── types.ts    Auto-generated DB types
supabase/
├── functions/      Deno Edge Functions (see §7)
├── migrations/     PostgreSQL migration files
└── config.toml     project_id = jsfzdlgfxvnlosrsafjw
public/
├── robots.txt
├── sitemap-index.xml
├── sitemap.xml
├── news-sitemap.xml
└── llms.txt        Static LLM context reference (points to this endpoint)
\`\`\`

---

## 13. Known Issues & Backlog

From the project plan (/.lovable/plan.md):

1. **2,670+ "waiting_for_ai" stubs** – pipeline used to create useless stub articles when AI credits ran out. Fixed in latest pipeline (no longer creates stubs).
2. **Pre-AI scoring** – implemented, threshold 0.40.
3. **URL branding** – several files still reference old domain \`investek.lovable.app\` instead of \`marketrends.lovable.app\`.
4. **Two empty categories** – "Penger & Karriere" and "Guider & Forklart" have zero published articles.
5. **CategoryPage SEO** – uses raw \`<Helmet>\` instead of \`<SEOHead>\` component.
6. **updated_at trigger** – trigger function exists but is not yet attached to articles table.

---

## 14. Context Endpoint

This document is always fresh. Share this URL with any LLM to instantly bring it up to speed:

\`\`\`
https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/project-context
\`\`\`

Last pipeline activity: ${lastFetchStr}
`;

  return new Response(doc, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
