// Combined sitemap for knowledge pages, comparisons, guides.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = "https://marketrends.no";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

  const [{ data: k }, { data: c }, { data: g }] = await Promise.all([
    supabase.from("knowledge_pages").select("slug, updated_at").eq("published", true).limit(5000),
    supabase.from("comparison_pages").select("slug, updated_at").eq("published", true).limit(5000),
    supabase.from("guides").select("slug, updated_at").eq("published", true).limit(5000),
  ]);

  const url = (path: string, mod: string) => `
  <url><loc>${SITE}${path}</loc><lastmod>${new Date(mod).toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;

  const urls = [
    ...(k || []).map((r) => url(`/knowledge/${r.slug}`, r.updated_at)),
    ...(c || []).map((r) => url(`/compare/${r.slug}`, r.updated_at)),
    ...(g || []).map((r) => url(`/guide/${r.slug}`, r.updated_at)),
    url("/academy", new Date().toISOString()),
    url("/tools", new Date().toISOString()),
  ].join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;
  return new Response(xml, {
    headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8" },
  });
});
