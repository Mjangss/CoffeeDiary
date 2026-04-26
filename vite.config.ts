import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildId = Date.now();

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(), 
    viteSingleFile(),
    {
      name: 'generate-version-json',
      closeBundle() {
        const distPath = path.resolve(__dirname, 'dist');
        if (!fs.existsSync(distPath)) fs.mkdirSync(distPath, { recursive: true });
        fs.writeFileSync(
          path.join(distPath, 'version.json'), 
          JSON.stringify({ buildId, updatedAt: new Date().toISOString() }, null, 2)
        );
        console.log(`\n\n✅ Version info synchronized: ${buildId}\n`);
      }
    }
  ],
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
