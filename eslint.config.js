// Copyright © 2026 Mcont.

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import typescriptEslint from "typescript-eslint";

/**
 * Shared lint policy for repository JavaScript and TypeScript sources.
 *
 * Generated output and dependency directories are excluded at the repository
 * boundary. ESLint's recommended JavaScript rules and typescript-eslint's
 * strict, syntax-aware rules then form the baseline for every workspace
 * package. Warnings fail the root lint command so local and CI results cannot
 * silently diverge.
 */
export default defineConfig(
  {
    ignores: ["**/coverage/**", "**/dist/**", "**/node_modules/**"],
  },
  eslint.configs.recommended,
  typescriptEslint.configs.strict,
  {
    files: ["**/*.{cts,mts,ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "separate-type-imports",
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
