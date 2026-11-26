import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The site is served from a project page, so every asset path has to carry the
// repository name. Getting this wrong produces a blank page that works locally.
export default defineConfig({
  base: "/global-food-system-observatory/",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false },
});
