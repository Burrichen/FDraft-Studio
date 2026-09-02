// @ts-check
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "**/*.config.{js,ts,mjs,cjs}", "apps/studio/src-tauri/**"],
  },
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Theme documents carry a lot of narrow, intentionally-unused
      // destructured fields (e.g. stripping `manifest` before hashing) —
      // requiring an underscore prefix instead of banning this outright.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["packages/theme-renderer/**/*.{ts,tsx}", "apps/renderer-lab/**/*.{ts,tsx}", "apps/studio/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
);
