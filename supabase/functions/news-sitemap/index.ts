import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml; charset=utf-8',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: articles, error } = await supabase
      .from('articles')
      .select('title, slug, created_at, tags, category, meta_description')
      .eq('published', true)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    const domain = 'https://marketrends.no';

    const urls = (articles || []).map((a) => {
      const pubDate = new Date(a.created_at).toISOString();
      const keywords = (a.tags || []).slice(0, 10).join(', ');
      return `  <url>
    <loc>${domain}/${a.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>Marketrends.no</news:name>
        <news:language>no</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>${keywords ? `\n      <news:keywords>${escapeXml(keywords)}</news:keywords>` : ''}
    </news:news>
    <lastmod>${pubDate}</lastmod>
    <changefreq>never</changefreq>
  </url>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

    return new Response(xml, { headers: corsHeaders });
  } catch (err) {
    console.error('News sitemap error:', err);
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`, {
      headers: corsHeaders,
    });
  }
});

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
