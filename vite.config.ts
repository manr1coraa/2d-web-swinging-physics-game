import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  // dev server has to be reachable from the sandbox preview proxy;
  // strictPort keeps the preview on 5173 instead of silently moving to 5174
  server: { host: true, allowedHosts: true, port: 5173, strictPort: true },
  // a second, dev-free entry point: the built single-file app served statically
  preview: { host: true, allowedHosts: true, port: 4173, strictPort: true },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
