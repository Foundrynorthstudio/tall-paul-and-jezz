import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: "sets-page",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const path = req.url?.split("?")[0];
          if (path === "/sets" || path === "/sets/") req.url = "/sets/index.html";
          next();
        });
      },
    },
  ],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input:
        command === "serve"
          ? {
              main: resolve(__dirname, "index.html"),
              sets: resolve(__dirname, "sets/index.html"),
            }
          : resolve(__dirname, "index.html"),
    },
  },
}));
