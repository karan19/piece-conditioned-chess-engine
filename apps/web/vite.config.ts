import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Each feature has its own HTML entry, including when a nested route is refreshed.
const featureRoutes: Plugin = {
  name: "chess-feature-routes",
  configureServer(server) { server.middlewares.use(rewriteFeatureEntry); },
  configurePreviewServer(server) { server.middlewares.use(rewriteFeatureEntry); },
};
function rewriteFeatureEntry(req: { url?: string }, _res: unknown, next: () => void) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const feature = ["guided-play", "opening-studio", "board-recall"].find(name => url.pathname.startsWith(`/${name}/`) && !url.pathname.includes("."));
  if (feature) req.url = `/${feature}/index.html${url.search}`;
  next();
}
export default defineConfig({
  plugins: [featureRoutes, react()],
  build: {
    rollupOptions: {
      input: { home: "index.html", app: "guided-play/index.html", studio: "opening-studio/index.html", recall: "board-recall/index.html", legacyStudio: "v2/index.html" },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
