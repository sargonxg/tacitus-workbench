import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  esbuild: { jsx: "automatic" },
  build: { outDir: "showcase-dist", rollupOptions: { input: "showcase.html" } },
});
