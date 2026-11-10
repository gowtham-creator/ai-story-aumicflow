/// <reference types="node" />

import * as path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { componentTagger } from "@devvai/devv-tagger-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [componentTagger(), react()],

  base: "/",   // <-- VERY IMPORTANT FOR RENDER

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  worker: {
    format: "es",
  },

  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5001",
        changeOrigin: true,
        secure: false,
        ws: true,
        proxyTimeout: 0,
        timeout: 0,
      },
      "/ws": {
        target: "ws://127.0.0.1:5001",
        ws: true,
      },
    },
  },
});
