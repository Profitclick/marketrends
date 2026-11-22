import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { buildPublicArtifacts } from "./scripts/build-public-artifacts.mjs";

// Public artifacts remain generated after the client bundle, but the deterministic
// pipeline itself is framework-independent and can later be reused by TanStack Start.
const publicArtifactsPlugin = (env: Record<string, string>) => ({
  name: "marketrends-public-artifacts",
  apply: "build" as const,
  async closeBundle() {
    await buildPublicArtifacts(path.resolve(__dirname, "dist"), {
      supabaseUrl: env.VITE_SUPABASE_URL,
      supabasePublishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    server: { host: "::", port: 8080 },
    plugins: [react(), mode === "development" && componentTagger(), publicArtifactsPlugin(env)].filter(Boolean),
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  };
});
