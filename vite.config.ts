import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["onetest-mark.svg"],
      workbox: {
        globIgnores: ["**/exceljs.min-*.js"]
      },
      manifest: {
        name: "OneTest Secure Portal",
        short_name: "OneTest",
        description: "Mobile-first secure examination portal for colleges.",
        theme_color: "#fff3dd",
        background_color: "#fff3dd",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/onetest-mark.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
