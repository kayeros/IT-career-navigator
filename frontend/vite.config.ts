/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api проксируется на backend: страницы и API живут на одном origin,
// поэтому cookie сессии работает без CORS
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8080", changeOrigin: false } },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // В Node Request не принимает относительные адреса
    env: { VITE_API_BASE: "http://localhost/api/v1" },
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
