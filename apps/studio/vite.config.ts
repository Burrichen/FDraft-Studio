import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed dev-server port (see src-tauri/tauri.conf.json's
// devUrl) and needs to ignore src-tauri/ so Rust rebuilds don't trigger a
// frontend reload loop.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5190,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    outDir: "dist",
    // A Tauri app ships its own bundled webview (WKWebView / WebView2) to
    // every user rather than targeting the public web, so there's no need
    // for the conservative "safari13" target some Tauri scaffolds default
    // to — which, at this esbuild version, also fails to transform some
    // modern destructuring patterns at all. es2022 matches what both
    // platforms' current webviews actually support.
    target: "es2022",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
