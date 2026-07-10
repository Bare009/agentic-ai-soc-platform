import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API base for local dev. In production the app is served by nginx which
// proxies /api to the api service, so the frontend always uses relative /api.
const API_TARGET = process.env.VITE_API_TARGET || "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        ws: true, // proxy the /api/v1/ws/live websocket too
      },
    },
  },
});
