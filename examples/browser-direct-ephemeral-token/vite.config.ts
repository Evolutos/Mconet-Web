// Copyright © 2026 Mcont.

import path from "node:path";
import { fileURLToPath } from "node:url";

/** Directory of this browser example. */
const exampleRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite configuration for the direct browser page.
 *
 * The page is the only input. A long-lived vendor key is not part of this graph.
 */
export default {
  root: exampleRoot,
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: path.join(exampleRoot, "index.html"),
    },
  },
};
