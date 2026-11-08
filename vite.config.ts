import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { generateSitemaps } from "./scripts/generate-sitemaps.mjs";
import { prerender } from "./scripts/prerender.mjs";

// Public sitemaps are generated into the build output so they are served from https://marketrends.no.
const sitemapPlugin = (env: Record<string, string>) => ({
  name: "marketrends-sitemaps",
  apply: "build" as const,
  async closeBundle() {
    try {
      const r = await generateSitemaps(path.resolve(__dirname, "dist"), env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
      console.log(`[sitemaps] ${r.files.length} files, ${r.articles} articles, ${r.news} news`);
    } catch (e) {
      console.warn("[sitemaps] generation failed:", (e as Error).message);
    }
    // Route-specific static HTML for public routes; client React boots normally on top.
    try {
      const p = await prerender(path.resolve(__dirname, "dist"), env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
      console.log(`[prerender] ${p.written} routes written, ${p.articles} articles, ${p.failed.length} failed`);
      p.failed.slice(0, 20).forEach((f) => console.warn("[prerender] FAILED", f));
    } catch (e) {
      console.warn("[prerender] aborted, SPA shell only:", (e as Error).message);
    }
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    server: { host: "::", port: 8080 },
    plugins: [react(), mode === "development" && componentTagger(), sitemapPlugin(env)].filter(Boolean),
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  };
});
