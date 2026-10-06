// Copyright © 2026 Mcont.

import { defineConfig } from "vitest/config";

/** Conformance tests verify language-neutral schemas and golden fixtures. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["spec/conformance/**/*.{spec,test}.ts"],
    passWithNoTests: true,
  },
});
