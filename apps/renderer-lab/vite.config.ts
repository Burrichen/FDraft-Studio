import { join } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fdraftFixturesPlugin } from "./src/plugins/fdraftFixturesPlugin.js";

const fixturesRoot = join(import.meta.dirname, "../../fixtures");

export default defineConfig({
  plugins: [react(), fdraftFixturesPlugin(fixturesRoot)],
  server: {
    port: 5183,
  },
  build: {
    outDir: "dist",
  },
});
