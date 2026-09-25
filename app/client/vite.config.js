// During development, /api calls go to the Node server on port 4000,
// so the browser sees one origin and the session cookie just works.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:4000" } },
  build: { sourcemap: false }, // don't ship source maps to the public
});
