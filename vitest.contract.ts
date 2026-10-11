// Copyright © 2026 Mcont.

import { defineConfig } from "vitest/config";
import { createPackageProjects } from "./vitest.projects.js";

/** Contract tests run separately so reusable component suites cannot become unit tests. */
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: createPackageProjects(
      ["src/**/*.contract.{spec,test}.ts"],
      [
        "src/**/*.chromium.contract.test.ts",
        "src/**/*.firefox.contract.test.ts",
        "src/**/*.webkit.contract.test.ts",
      ],
      "contract",
    ),
  },
});
