import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdmin } from "../_shared/admin-auth.ts";
import { startRun, finishRun } from "../_shared/run-lock.ts";
import { evaluateDuplicate, recordVerdict } from "../_shared/dupe.ts";
import { normalizeUrl } from "../_shared/semantic.ts";
import { ingestionMode } from "./mode.ts";
import { normalizeImageUrl } from "./image-url.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RSSFeed {
  id: string;
  name: string;
  url: string;
  active: boolean;
}

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  content?: string;
  imageUrl?: string;
  feedName?: string;
}

const RATE_LIMIT = {
  maxRetries: 3,
  baseDelayMs: 3000,
  maxDelayMs: 45000,
  aiRequestDelayMs: 2000,
  maxArticlesPerRun: 8,
  maxFeedsPerRun: 7,
};

const AUTO_PUBLISH = { minScore: 0.75 };
const PRE_AI_THRESHOLD = 0.40;

// Source authority tiers
const TIER_1_SOURCES = ['Reuters', 'AP News', 'CNBC', 'CoinDesk', 'TechCrunch', 'Digi.no', 'Teknisk Ukeblad', 'The Block', 'Bloomberg'];
const TIER_2_SOURCES = ['Google News', 'The Verge', 'Wired', 'MarketWatch', 'VentureBeat', 'Ars Technica', 'Shifter'];

// High-value keywords for scoring
const HIGH_VALUE_KEYWORDS = [
  'ai', 'artificial intelligence', 'bitcoin', 'btc', 'ethereum', 'crypto', 'blockchain',
  'billion', 'million', 'ipo', 'merger', 'acquisition', 'startup', 'funding', 'venture',
  'breaking', 'crash', 'surge', 'record', 'hack', 'breach', 'launch', 'nvidia', 'openai',
  'google', 'apple', 'microsoft', 'meta', 'amazon', 'tesla', 'regulation', 'sec', 'fed',
  'interest rate', 'inflation', 'recession', 'bull', 'bear', 'rally', 'etf',
  'norge', 'norsk', 'oslo børs', 'dnb', 'equinor', 'telenor', 'vipps'
];

const MARKETRENDS_CATEGORIES = [
  'finans', 'finance', 'market', 'stock', 'crypto', 'bitcoin', 'blockchain',
  'ai', 'tech', 'startup', 'venture', 'investment', 'trading', 'economy',
  'bank', 'fintech', 'defi', 'nft', 'regulation', 'innovation'
];

function calculatePreAIScore(item: RSSItem, feedName: string): number {
  let score = 0;
  const titleLower = (item.title || '').toLowerCase();
  const descLower = (item.description || '').toLowerCase();
  const combined = titleLower + ' ' + descLower;

  // Source authority
  if (TIER_1_SOURCES.some(s => feedName.toLowerCase().includes(s.toLowerCase()))) {
    score += 0.25;
  } else if (TIER_2_SOURCES.some(s => feedName.toLowerCase().includes(s.toLowerCase()))) {
    score += 0.15;
  } else {
    score += 0.08;
  }

  // High-value keywords (count matches, cap at 0.25)
  const keywordMatches = HIGH_VALUE_KEYWORDS.filter(k => combined.includes(k)).length;
  score += Math.min(keywordMatches * 0.05, 0.25);

  // Title quality
  const titleLen = (item.title || '').length;
  if (titleLen >= 30 && titleLen <= 90) score += 0.08;

  // Category relevance
  const categoryMatches = MARKETRENDS_CATEGORIES.filter(c => combined.includes(c)).length;
  score += Math.min(categoryMatches * 0.04, 0.15);

  // Freshness
  if (item.pubDate) {
    try {
      const pubTime = new Date(item.pubDate).getTime();
      const hoursAgo = (Date.now() - pubTime) / (1000 * 60 * 60);
      if (hoursAgo < 6) score += 0.10;
      else if (hoursAgo < 24) score += 0.05;
      else if (hoursAgo > 72) score -= 0.10;
    } catch { /* ignore parse errors */ }
  }

  return Math.max(0, Math.min(score, 1.0));
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getBackoffDelay(retryCount: number): number {
  return Math.min(RATE_LIMIT.baseDelayMs * Math.pow(2, retryCount), RATE_LIMIT.maxDelayMs) + Math.random() * 1500;
}

function calculateBackupScore(article: {
  content: string; meta_description: string | null; tags: string[];
  article_type: string | null; image_url: string | null; title: string;
}): number {
  let score = 0.45;
  const wordCount = article.content.split(/\s+/).length;
  if (wordCount > 800) score += 0.15;
  else if (wordCount > 500) score += 0.10;
  else if (wordCount > 300) score += 0.05;
  if (article.content.includes('## ') || article.content.includes('### ')) score += 0.10;
  if (article.meta_description && article.meta_description.length >= 100) score += 0.10;
  if (article.tags && article.tags.length >= 3) score += 0.10;
  if (article.article_type && ['analysis', 'guide', 'feature', 'breaking'].includes(article.article_type)) score += 0.10;
  if (article.image_url) score += 0.05;
  return Math.min(score, 1.0);
}

function parseRSS(xmlText: string, maxItems: number = 5): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
  const matches = [...xmlText.matchAll(itemRegex)];

  for (const match of matches.slice(0, maxItems)) {
    const x = match[1];
    const title = x.match(/<title(?:[^>]*)>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() || '';
    const link = x.match(/<link(?:[^>]*)>([\s\S]*?)<\/link>/i)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() ||
                 x.match(/<link[^>]*href="([^"]+)"/i)?.[1] || '';
    const description = x.match(/<description(?:[^>]*)>([\s\S]*?)<\/description>/i)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() || '';
    const content = x.match(/<content:encoded(?:[^>]*)>([\s\S]*?)<\/content:encoded>/i)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() || '';
    const pubDate = x.match(/<pubDate(?:[^>]*)>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ||
                    x.match(/<published(?:[^>]*)>([\s\S]*?)<\/published>/i)?.[1]?.trim() || '';
    const imageUrl = x.match(/<media:content[^>]*url="([^"]+)"/i)?.[1] ||
                     x.match(/<enclosure[^>]*url="([^"]+)"/i)?.[1] ||
                     x.match(/<image>[\s\S]*?<url>([^<]+)<\/url>/i)?.[1] || '';

    if (title && link) items.push({ title, link, description, pubDate, content, imageUrl: normalizeImageUrl(imageUrl) ?? undefined });
  }
  return items;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function generateSlug(title: string): string {
  return title.toLowerCase()
    .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 100);
}

async function processArticleWithAI(item: RSSItem, sourceName: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const cleanContent = stripHtml(item.content || item.description || '');

  const systemPrompt = `Du er redaksjonen i Marketrends.no – en norsk, uavhengig fagpublikasjon innen finans, fintech, teknologi og investeringer. Skriv som en nøktern, objektiv finansjournalist.

REGLER:
- Aldri direkte oversettelse. Omskriv og kontekstualiser for norske lesere.
- Saklig, presist, forklarende språk. Ingen hype eller salgsretorikk.
- Tittel: <70 tegn, presis og nyhetsverdig (ikke clickbait)
- Meta: 140-160 tegn, faktabasert
- Korte avsnitt (2-4 setninger)
- Alltid norsk kontekst eller referanse

STRUKTUR:
1. **Ingress** – 2 setninger som oppsummerer saken objektivt
2. **Bakgrunn** – 3-4 avsnitt med fakta og kontekst
3. **Norsk kontekst** – Hva betyr dette for Norge/norske aktører?
4. **Konsekvenser** – Hva skjer videre, implikasjoner

KATEGORIER: "Krypto & Trading", "Teknologi & AI", "Finans & Marked", "Gründer & Startups", "Penger & Karriere", "Trender & Analyse", "Guider & Forklart"
ARTIKKELTYPE: "breaking" (akutt nyhet), "analysis" (dybdeanalyse), "guide" (forklarende), "feature" (lengre reportasje)

RETURNER JSON:
{"title":"...","meta_description":"...","category":"...","article_type":"...","tags":["t1","t2","t3","t4","t5"],"content":"## ...\\n\\n**Ingress:** ...\\n\\n### Bakgrunn\\n...\\n\\n### Norsk kontekst\\n...\\n\\n### Konsekvenser\\n...","archived_sources":["url"],"risk_warning":"...","ai_quality_score":0.85}`;

  const userPrompt = `Skriv om til norsk fagartikkel for Marketrends.no. Ikke oversett direkte – kontekstualiser for norske lesere.

TITTEL: ${item.title}
KILDE: ${sourceName}
INNHOLD: ${cleanContent.substring(0, 3000)}

Gi ai_quality_score (0.0-1.0) basert på faglig verdi, norsk relevans og redaksjonell kvalitet.`;

  for (let retry = 0; retry < RATE_LIMIT.maxRetries; retry++) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
        }),
      });

      if (response.status === 429) {
        console.log(`Rate limited (429), retry ${retry + 1}...`);
        await sleep(getBackoffDelay(retry));
        continue;
      }

      if (response.status === 402) {
        console.log("⚠️ AI credits depleted (402) – skipping remaining articles");
        return { _status: "credits_depleted" };
      }

      if (!response.ok) {
        console.error(`AI error: ${response.status}`);
        if (response.status >= 500) { await sleep(getBackoffDelay(retry)); continue; }
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      try {
        const parsed = JSON.parse(jsonMatch[0]);
        let qualityScore = null;
        if (typeof parsed.ai_quality_score === 'number') qualityScore = parsed.ai_quality_score;
        else if (typeof parsed.ai_quality_score === 'string') {
          const n = parseFloat(parsed.ai_quality_score);
          if (!isNaN(n)) qualityScore = n;
        }
        if (qualityScore === null) {
          const m = content.match(/"ai_quality_score"\s*:\s*([\d.]+)/);
          if (m) qualityScore = parseFloat(m[1]);
        }
        if (qualityScore !== null) qualityScore = Math.max(0, Math.min(1, qualityScore));
        parsed.ai_quality_score = qualityScore;
        return parsed;
      } catch { return null; }
    } catch (error) {
      console.error("AI processing error:", error);
      if (retry < RATE_LIMIT.maxRetries - 1) await sleep(getBackoffDelay(retry));
    }
  }
  return null;
}

async function logToSystem(supabase: any, logLevel: string, logType: string, message: string, context?: any, articleId?: string, feedId?: string) {
  try {
    await supabase.from('system_logs').insert({
      log_level: logLevel, log_type: logType, message,
      context: context || null, article_id: articleId || null, feed_id: feedId || null,
    });
  } catch (error) { console.error("Log error:", error); }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  // Auth gate: service-role, scheduler (CRON_SECRET) or an admin user JWT.
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabase = auth.supabase;
  const body = await req.json().catch(() => ({}));
  const { dryRun, fetchOnly } = ingestionMode(body ?? {});
  const lovableKey = Deno.env.get('LOVABLE_API_KEY') ?? '';

  // Exclusive lock: never let two ingest runs overlap.
  const runId = dryRun ? null : await startRun(supabase, 'fetch-and-process-feeds', 20);
  if (!dryRun && !runId) {
    return new Response(JSON.stringify({ ok: false, skipped: true, reason: 'run already in progress' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let totalSemanticDupes = 0;
  let totalFailed = 0;

  try {
    console.log("Starting Marketrends.no feed processing...");

    if (!dryRun) await logToSystem(supabase, 'info', 'rss_fetch', 'Starting feed processing', { run_id: runId });


    // Fetch active feeds, rotate by least recently fetched
    const { data: allFeeds, error: feedsError } = await supabase
      .from('rss_feeds').select('*').eq('active', true)
      .order('last_fetched', { ascending: true, nullsFirst: true });

    if (feedsError) throw feedsError;

    const feeds = (allFeeds || []).slice(0, RATE_LIMIT.maxFeedsPerRun);
    console.log(`Processing ${feeds.length} of ${allFeeds?.length || 0} active feeds`);

    let totalProcessed = 0;
    let totalNew = 0;
    let totalAutoPublished = 0;
    let totalSkippedLowScore = 0;
    let creditsDepleted = false;
    let consecutiveFailures = 0;
    const results: any[] = [];

    // Collect all items from all feeds first, then score and sort
    const allItems: { item: RSSItem; feedName: string; feedId: string; preScore: number }[] = [];
    const feedChecks: { name: string; status: number | null; items: number; error?: string }[] = [];

    for (const feed of (feeds as RSSFeed[])) {
      try {
        const rssResponse = await fetch(feed.url, {
          headers: { 'User-Agent': 'Marketrends.no/1.0 (feed-processor)' },
          signal: AbortSignal.timeout(10000),
        });

        if (dryRun || fetchOnly) {
          const items = rssResponse.ok ? parseRSS(await rssResponse.text(), 5) : [];
          feedChecks.push({ name: feed.name, status: rssResponse.status, items: items.length });
          for (const item of items) {
            allItems.push({ item, feedName: feed.name, feedId: feed.id, preScore: calculatePreAIScore(item, feed.name) });
          }
          if (!dryRun) await supabase.from('rss_feeds').update({ last_fetched: new Date().toISOString() }).eq('id', feed.id);
          continue;
        }

        if ([401, 403, 404].includes(rssResponse.status)) {
          console.warn(`⚠️ Deactivating feed ${feed.name} (HTTP ${rssResponse.status})`);
          await supabase.from('rss_feeds').update({ active: false }).eq('id', feed.id);
          await logToSystem(supabase, 'warn', 'rss_fetch', `Auto-deactivated: ${feed.name} (${rssResponse.status})`, { status: rssResponse.status }, undefined, feed.id);
          continue;
        }

        if (!rssResponse.ok) {
          console.error(`Failed: ${feed.name} (${rssResponse.status})`);
          await logToSystem(supabase, 'error', 'rss_fetch', `Failed: ${feed.name}`, { status: rssResponse.status }, undefined, feed.id);
          continue;
        }

        const xmlText = await rssResponse.text();
        const items = parseRSS(xmlText, 5);
        console.log(`Parsed ${items.length} items from ${feed.name}`);

        for (const item of items) {
          const preScore = calculatePreAIScore(item, feed.name);
          allItems.push({ item, feedName: feed.name, feedId: feed.id, preScore });
        }

        // Update last_fetched
        await supabase.from('rss_feeds').update({ last_fetched: new Date().toISOString() }).eq('id', feed.id);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Error processing ${feed.name}: ${msg}`);
        feedChecks.push({ name: feed.name, status: null, items: 0, error: msg });
        if (!dryRun) {
          await logToSystem(supabase, 'error', 'rss_fetch', `Error: ${feed.name}: ${msg}`, null, undefined, feed.id);
          await supabase.from('rss_feeds').update({ last_fetched: new Date().toISOString() }).eq('id', feed.id);
        }
      }
    }

    if (dryRun || fetchOnly) {
      const report = {
        dry_run: dryRun, fetch_only: fetchOnly, feeds: feedChecks,
        total_items_collected: allItems.length,
        items_above_threshold: allItems.filter(i => i.preScore >= PRE_AI_THRESHOLD).length,
        ai_calls: 0, articles_created: 0, articles_auto_published: 0,
      };
      if (runId) await finishRun(supabase, runId, feedChecks.some(f => f.status !== 200) ? 'partial' : 'success', {
        processed: allItems.length, details: report,
      });
      return new Response(JSON.stringify(report), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Sort by pre-AI score (highest first)
    allItems.sort((a, b) => b.preScore - a.preScore);
    console.log(`Total items collected: ${allItems.length}, processing top ${RATE_LIMIT.maxArticlesPerRun} by score`);

    // Process items in score order
    for (const { item, feedName, feedId, preScore } of allItems) {
      if (totalNew >= RATE_LIMIT.maxArticlesPerRun || creditsDepleted) break;
      totalProcessed++;

      // Skip low-scoring items
      if (preScore < PRE_AI_THRESHOLD) {
        totalSkippedLowScore++;
        continue;
      }

      // Layer 1 — exact/normalized source URL match
      const { data: existing } = await supabase
        .from('articles').select('id').eq('source_url', item.link).maybeSingle();
      if (existing) continue;
      const normalized = normalizeUrl(item.link);
      const { data: urlTwin } = await supabase
        .from('articles').select('id,source_url')
        .ilike('source_url', `%${normalized.split('/').pop() || normalized}%`).limit(5);
      if ((urlTwin || []).some((a) => normalizeUrl(a.source_url) === normalized)) {
        totalSemanticDupes++;
        continue;
      }


      await sleep(RATE_LIMIT.aiRequestDelayMs);
      console.log(`[score=${preScore.toFixed(2)}] AI processing: ${item.title.substring(0, 60)}...`);
      const aiResult = await processArticleWithAI(item, feedName);

      // Credits depleted – stop processing, DON'T create stub articles
      if (aiResult && aiResult._status === "credits_depleted") {
        creditsDepleted = true;
        await logToSystem(supabase, 'warn', 'ai_processing', 'AI credits depleted – stopping batch');
        break;
      }

      if (!aiResult) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          console.log("Too many consecutive AI failures, cooling down 15s...");
          await sleep(15000);
          consecutiveFailures = 0;
        }
        continue;
      }

      consecutiveFailures = 0;
      const finalSlug = generateSlug(aiResult.title);
      const imageUrl = normalizeImageUrl(item.imageUrl);

      let qualityScore: number;
      let scoreSource: string;
      if (typeof aiResult.ai_quality_score === 'number' && aiResult.ai_quality_score >= 0 && aiResult.ai_quality_score <= 1) {
        qualityScore = aiResult.ai_quality_score;
        scoreSource = 'ai';
      } else {
        qualityScore = calculateBackupScore({
          content: aiResult.content || '', meta_description: aiResult.meta_description || null,
          tags: aiResult.tags || [], article_type: aiResult.article_type || null,
          image_url: imageUrl, title: aiResult.title || ''
        });
        scoreSource = 'backup';
      }

      const shouldPublish = qualityScore >= AUTO_PUBLISH.minScore;

      // Layer 2 — semantic duplicate gate. Blocks re-reporting of the same event
      // across feeds, and yields the embedding we persist with the row.
      let embedding: number[] | null = null;
      try {
        const verdict = await evaluateDuplicate(supabase, lovableKey, {
          type: 'article',
          ref: finalSlug,
          title: aiResult.title,
          text: aiResult.content || '',
          entities: aiResult.tags || [],
          topics: [aiResult.category].filter(Boolean),
          event: aiResult.title,
          source_url: item.link,
          published_at: new Date().toISOString(),
        });
        embedding = verdict.embedding;
        if (verdict.decision === 'duplicate') {
          totalSemanticDupes++;
          await recordVerdict(supabase, {
            type: 'article', ref: finalSlug, title: aiResult.title, text: '',
          }, verdict, 'blocked-at-ingest');
          await logToSystem(supabase, 'info', 'ai_processing',
            `🚫 Semantic duplicate blocked: ${aiResult.title.substring(0, 60)}`,
            { score: verdict.score, match: verdict.match });
          continue;
        }
        if (verdict.decision === 'merge') {
          await recordVerdict(supabase, {
            type: 'article', ref: finalSlug, title: aiResult.title, text: '',
          }, verdict, 'flagged-near-duplicate');
        }
      } catch (e) {
        // Dedup must never block ingestion — fail open, but record it.
        console.error('semantic dedup failed:', e);
        await logToSystem(supabase, 'warn', 'ai_processing', 'Semantic dedup unavailable, ingesting without it', {
          error: String(e).slice(0, 300),
        });
      }

      const { data: insertedArticle, error: insertError } = await supabase
        .from('articles')
        .insert({
          title: aiResult.title, slug: finalSlug,
          meta_description: aiResult.meta_description,
          tags: aiResult.tags || [], category: aiResult.category || 'Teknologi & AI',
          article_type: aiResult.article_type || 'news',
          ai_quality_score: qualityScore, content: aiResult.content,
          source_url: item.link, source_name: feedName,
          image_url: imageUrl, published: shouldPublish, ai_status: 'success',
          archived_sources: aiResult.archived_sources || [item.link],
          risk_warning: aiResult.risk_warning || null,
          embedding: embedding as any,
          embedded_at: embedding ? new Date().toISOString() : null,
          processing_log: {
            processed_at: new Date().toISOString(), source: feedName,
            auto_published: shouldPublish, quality_score: qualityScore,
            score_source: scoreSource, pre_ai_score: preScore, run_id: runId,
          }
        })
        .select().single();

      if (!insertError && insertedArticle) {
        totalNew++;
        if (shouldPublish) totalAutoPublished++;
        const logMsg = shouldPublish
          ? `✅ Published: ${aiResult.title.substring(0, 60)} (q=${qualityScore.toFixed(2)}, pre=${preScore.toFixed(2)})`
          : `📋 Queued: ${aiResult.title.substring(0, 60)} (q=${qualityScore.toFixed(2)})`;
        console.log(logMsg);
        await logToSystem(supabase, 'info', 'ai_processing', logMsg, {
          slug: finalSlug, quality_score: qualityScore, score_source: scoreSource,
          pre_ai_score: preScore, auto_published: shouldPublish
        }, insertedArticle.id);
        results.push({ title: aiResult.title, slug: finalSlug, quality_score: qualityScore, pre_ai_score: preScore, auto_published: shouldPublish });

        // Enrich (topics + entities) immediately so the graph never falls behind.
        try {
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/enrich-article`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '',
            },
            body: JSON.stringify({ article_id: insertedArticle.id }),
          });
        } catch (e) { console.error('enrich dispatch failed', e); }
      } else if (insertError) {
        totalFailed++;
        console.error(`Insert error: ${insertError.message}`);
        await logToSystem(supabase, 'error', 'ai_processing', `Insert failed: ${insertError.message}`, { slug: finalSlug });
      }
    }

    const duration = Date.now() - startTime;
    const summary = {
      timestamp: new Date().toISOString(), duration_ms: duration, run_id: runId,
      feeds_in_batch: feeds.length, total_active_feeds: allFeeds?.length || 0,
      total_items_collected: allItems.length,
      items_above_threshold: allItems.filter(i => i.preScore >= PRE_AI_THRESHOLD).length,
      items_skipped_low_score: totalSkippedLowScore,
      articles_checked: totalProcessed,
      articles_created: totalNew, articles_auto_published: totalAutoPublished,
      duplicates_blocked: totalSemanticDupes,
      insert_failures: totalFailed,
      credits_depleted: creditsDepleted, results,
    };

    console.log("Processing complete:", JSON.stringify(summary));
    await logToSystem(supabase, 'info', 'rss_fetch', 'Processing completed', summary);
    if (runId) await finishRun(supabase, runId, totalFailed > 0 ? 'partial' : 'success', {
      processed: totalProcessed, published: totalAutoPublished, updated: totalNew,
      duplicates_blocked: totalSemanticDupes, failed: totalFailed, details: summary,
    });

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error("Feed processing error:", error);
    if (runId) await finishRun(supabase, runId, 'failed', { failed: totalFailed, duplicates_blocked: totalSemanticDupes }, msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
