import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 15173,
    proxy: {
      "/api": { target: "http://127.0.0.1:18700", changeOrigin: true },
      "/ws": { target: "ws://127.0.0.1:18700", ws: true },
    },
  },
  build: {
    // Split the vendor libraries that dominate the bundle so route chunks stay
    // small and long-lived dependencies keep their hashes across deploys.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
