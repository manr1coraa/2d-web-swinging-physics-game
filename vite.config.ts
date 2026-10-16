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
  // dev server has to be reachable from the sandbox preview proxy
  server: { host: true, allowedHosts: true, port: 5173 },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
