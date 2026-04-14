import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Proxy Nextmv API calls to avoid CORS issues
      "/api/nextmv": {
        target: "https://api.cloud.nextmv.io",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/nextmv/, ""),
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            // Log the proxied request
            console.log("Proxying request:", {
              method: proxyReq.method,
              path: proxyReq.path,
              headers: proxyReq.getHeaders(),
            });
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            // Log the response
            console.log("Proxy response:", {
              statusCode: proxyRes.statusCode,
              headers: proxyRes.headers,
            });
          });
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
