import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// /api and /actuator are proxied to the Spring Boot backend, so no CORS setup is needed in dev.
// 127.0.0.1 rather than localhost: Node 18+ may resolve localhost to IPv6 (::1) first, notably on Windows.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8080",
      "/actuator": "http://127.0.0.1:8080",
    },
  },
});
