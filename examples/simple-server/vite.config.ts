import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";

// Get the entry from environment variable, default to ui-react
const entry = process.env.VITE_ENTRY || "ui-react";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    rollupOptions: {
      input: resolve(__dirname, `${entry}.html`),
    },
    outDir: `dist`,
    emptyOutDir: false,
  },
});
