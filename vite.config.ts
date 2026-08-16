import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

const legalFiles = ["LICENSE", "THIRD_PARTY_DATA.md"] as const;

export default defineConfig(({ mode }) => {
  const target = mode === "firefox" ? "firefox" : "chrome";
  const outDir = mode === "firefox" ? "dist/firefox" : "dist/chrome";

  return {
    resolve: {
      alias: {
        "@retentia/release-notes": resolve(import.meta.dirname, "src", "shared", "release-notes", `${target}.ts`),
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "copy-browser-manifest-and-legal-files",
        apply: "build",
        closeBundle() {
          copyFileSync(
            resolve(import.meta.dirname, "manifests", `${target}.json`),
            resolve(import.meta.dirname, outDir, "manifest.json"),
          );
          for (const file of legalFiles) {
            copyFileSync(
              resolve(import.meta.dirname, file),
              resolve(import.meta.dirname, outDir, file),
            );
          }
        },
      },
    ],
    build: {
      outDir,
      emptyOutDir: true,
      modulePreload: false,
      rollupOptions: {
        input: {
          popup: resolve(import.meta.dirname, "popup.html"),
          dashboard: resolve(import.meta.dirname, "dashboard.html"),
          background: resolve(import.meta.dirname, "src/background/service-worker.ts"),
        },
        output: {
          entryFileNames: (chunk) =>
            chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
          manualChunks(id) {
            if (id.includes("category-domains.json")) return "category-database";
          },
        },
      },
    },
  };
});
