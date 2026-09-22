import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

// Baked into the bundle at build time (see components/BuildBadge.tsx) so it's possible
// to tell, just by looking at the running app, whether a given deploy actually reached
// this device versus an old cached PWA bundle still being served — a real recurring
// source of confusion (a fix would "not seem applied" and really just be stale cache).
function safeGitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  base: "/portfolio-tracker/", // GitHub Pages project-site path — must match the repo name
  define: {
    __BUILD_SHA__: JSON.stringify(safeGitSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // we ship our own public/manifest.webmanifest
      includeAssets: ["icons/*.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,json,png,svg}"],
      },
    }),
  ],
});
