// Public entity sitemap (all entities with >=1 mention)
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = "https://marketrends.no";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data } = await supabase
    .from("entities")
    .select("slug, updated_at, mention_count")
    .gt("mention_count", 0)
    .order("mention_count", { ascending: false })
    .limit(5000);

  const urls = (data || []).map((e) => `
  <url>
    <loc>${SITE}/entity/${e.slug}</loc>
    <lastmod>${new Date(e.updated_at).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;
  return new Response(xml, {
    headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8" },
  });
});
