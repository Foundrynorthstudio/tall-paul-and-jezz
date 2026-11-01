import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, "sets"),
  base: "/sets/",
  publicDir: false,
  build: {
    outDir: resolve(__dirname, "dist/sets"),
    emptyOutDir: true,
  },
});
