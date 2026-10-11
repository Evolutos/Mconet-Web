// Copyright © 2026 Mcont.

import path from "node:path";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Resolves a workspace package entry from its source file.
 *
 * @param {string} packageRole Package directory name.
 * @returns {string} Absolute source entry.
 */
function packageEntry(packageRole) {
  return path.join(workspaceRoot, "packages", packageRole, "src", "index.ts");
}

/**
 * Browser bundle configuration for the Fetch transport isolation check.
 *
 * The entry and its workspace dependencies are bundled from source. Node.js
 * built-ins stay visible when present so the check can reject them.
 */
export default {
  configFile: false,
  logLevel: "error",
  resolve: {
    alias: [
      { find: "@evolutos/mconet-core-domain", replacement: packageEntry("core-domain") },
      { find: "@evolutos/mconet-core-spi", replacement: packageEntry("core-spi") },
      {
        find: "@evolutos/mconet-transport-fetch-shared",
        replacement: packageEntry("transport-fetch-shared"),
      },
    ],
  },
  build: {
    emptyOutDir: true,
    lib: {
      entry: packageEntry("transport-fetch-browser"),
      fileName: "index",
      formats: ["es"],
    },
    minify: false,
    outDir: path.join(workspaceRoot, ".artifacts", "fetch-browser-bundle"),
    sourcemap: false,
  },
};
