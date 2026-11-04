import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = "https://marketrends.no";
const SITE_NAME = "Marketrends.no";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "rss"; // rss | json
    const category = url.searchParams.get("category") || null;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('articles')
      .select('id, title, slug, meta_description, category, content, image_url, created_at, updated_at, tags, source_name')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    const { data: articles, error } = await query;

    if (error) throw error;

    if (format === "json") {
      const jsonFeed = {
        version: "https://jsonfeed.org/version/1.1",
        title: SITE_NAME,
        home_page_url: SITE_URL,
        feed_url: `${SITE_URL}/api/export?format=json`,
        description: "Norges ledende kilde for finans, teknologi, krypto og markedsnyheter.",
        language: "nb-NO",
        items: (articles || []).map((a: any) => ({
          id: a.id,
          url: `${SITE_URL}/${a.slug}`,
          title: a.title,
          summary: a.meta_description || "",
          content_text: a.content?.substring(0, 500) || "",
          image: a.image_url || "",
          date_published: a.created_at,
          date_modified: a.updated_at,
          tags: a.tags || [],
          _source: a.source_name,
          _category: a.category,
        })),
      };

      return new Response(JSON.stringify(jsonFeed, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // Default: RSS 2.0 XML
    const rssItems = (articles || []).map((a: any) => `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${SITE_URL}/${a.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/${a.slug}</guid>
      <description><![CDATA[${a.meta_description || ""}]]></description>
      <category>${a.category}</category>
      <pubDate>${new Date(a.created_at).toUTCString()}</pubDate>
      ${a.image_url ? `<enclosure url="${a.image_url}" type="image/jpeg" />` : ""}
      <source url="${SITE_URL}">${SITE_NAME}</source>
    </item>`).join("\n");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}</link>
    <description>Norges ledende kilde for finans, teknologi, krypto og markedsnyheter.</description>
    <language>nb-NO</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/api/export?format=rss" rel="self" type="application/rss+xml" />
    ${rssItems}
  </channel>
</rss>`;

    return new Response(rss, {
      headers: { ...corsHeaders, 'Content-Type': 'application/rss+xml; charset=utf-8' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
