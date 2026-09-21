import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/portfolio-tracker/", // GitHub Pages project-site path — must match the repo name
  plugins: [react()],
});
