// Copyright © 2026 Mcont.

import { defineConfig } from "vitest/config";
import { createPackageProjects } from "./vitest.projects.js";

/** Shared workspace test configuration with one project per package. */
export default defineConfig({
  test: {
    coverage: {
      clean: true,
      cleanOnRerun: true,
      exclude: ["**/*.d.ts", "**/*.{spec,test}.ts"],
      include: ["packages/*/src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
    },
    passWithNoTests: true,
    projects: createPackageProjects(
      ["src/**/*.{spec,test}.ts"],
      ["src/**/*.contract.{spec,test}.ts"],
    ),
  },
});
