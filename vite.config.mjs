import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localPdfPreview } from "./scripts/local-pdf-preview.mjs";
import { pilotLocalApi } from "./scripts/pilot-local-api.mjs";

export default defineConfig({
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@phosphor-icons")) return "icons";
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) return "react-vendor";
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    entries: ["index.html"],
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: {
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.local-media/**", "**/.local-data/**"],
    },
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [localPdfPreview(), pilotLocalApi(), react()],
});
