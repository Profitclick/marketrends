import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml; charset=utf-8',
};

const SITE_URL = 'https://marketrends.no';

const CATEGORIES = [
  'krypto-trading',
  'teknologi-ai',
  'finans-marked',
  'grunder-startups',
  'penger-karriere',
  'trender-analyse',
  'guider-forklart',
];

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: articles, error } = await supabase
      .from('articles')
      .select('slug, created_at, updated_at')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    const now = new Date().toISOString();

    // Static pages
    const staticPages = [
      { loc: SITE_URL, changefreq: 'hourly', priority: '1.0', lastmod: now },
      { loc: `${SITE_URL}/om-oss`, changefreq: 'monthly', priority: '0.3', lastmod: now },
      ...CATEGORIES.map(cat => ({
        loc: `${SITE_URL}/kategori/${cat}`,
        changefreq: 'hourly' as const,
        priority: '0.8',
        lastmod: now,
      })),
    ];

    const staticUrls = staticPages.map(p => `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');

    const articleUrls = (articles || []).map(a => {
      const lastmod = a.updated_at || a.created_at;
      return `  <url>
    <loc>${SITE_URL}/${escapeXml(a.slug)}</loc>
    <lastmod>${new Date(lastmod).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${articleUrls}
</urlset>`;

    return new Response(xml, { headers: corsHeaders });
  } catch (err) {
    console.error('Sitemap error:', err);
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`, {
      headers: corsHeaders,
    });
  }
});
