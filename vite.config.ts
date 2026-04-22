import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // Custom SW (Workbox + Push) — see src/sw.ts
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      // We register manually in src/main.tsx (with iframe/preview guard).
      injectRegister: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Skip very large precache entries — runtime cache will handle them.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "favicon-32x32.png",
        "favicon-16x16.png",
      ],
      manifest: {
        name: "CONGRESSAPP — Health Plus Travels",
        short_name: "CONGRESSAPP",
        start_url: "/",
        display: "standalone",
        theme_color: "#1A56A0",
        background_color: "#ffffff",
        icons: [
          { src: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
          { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
