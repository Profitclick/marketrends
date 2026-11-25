import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { fileURLToPath } from "node:url";

const routerCompat = fileURLToPath(new URL("./src/lib/routerCompat.tsx", import.meta.url));
const helmetCompat = fileURLToPath(new URL("./src/lib/helmetCompat.tsx", import.meta.url));

export default defineConfig({
  nitro: true,
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        "react-router-dom": routerCompat,
        "react-helmet": helmetCompat,
      },
    },
  },
});
