// Topic sitemap for /topic/:slug pages
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const BASE_URL = "https://marketrends.no";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data } = await supabase
    .from("topics")
    .select("slug, last_article_at, updated_at, article_count")
    .gte("article_count", 2)
    .order("article_count", { ascending: false })
    .limit(2000);

  const urls = (data || []).map(t => {
    const lastmod = (t.last_article_at || t.updated_at || new Date().toISOString()).slice(0, 10);
    return `  <url><loc>${BASE_URL}/topic/${t.slug}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=1800",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
