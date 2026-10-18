// Copyright © 2026 Mcont.

import path from "node:path";
import { fileURLToPath } from "node:url";

/** Directory of this example. The BFF server lives beside it and is not an input. */
const exampleRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite configuration for the browser page only.
 *
 * The server module is outside `src` and is not listed as an input, so a
 * vendor credential read by that process cannot enter the browser bundle.
 * Requests under `/bff` are forwarded to that process on 127.0.0.1:8787.
 * The chat client appends `/chat/completions`, so the forwarded path is
 * `/bff/chat/completions`.
 */
export default {
  root: exampleRoot,
  server: {
    proxy: {
      "/bff": "http://127.0.0.1:8787",
    },
  },
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: path.join(exampleRoot, "index.html"),
    },
  },
};
