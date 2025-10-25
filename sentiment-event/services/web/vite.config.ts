import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@pkg/shared": resolve(__dirname, "../../packages/shared/src"),
      "@pkg/schemas": resolve(__dirname, "../../packages/schemas/src")
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4003"
    }
  }
});
