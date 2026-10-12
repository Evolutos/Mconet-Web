// Copyright © 2026 Mcont.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Browser example whose page must not contain a vendor secret. */
const exampleRoot = path.join(workspaceRoot, "examples", "browser-bff");

/** Text that would place the server credential in a browser file. */
const vendorCredentialName = "VENDOR_API_KEY";

/**
 * Reads every browser source file that Vite can include from the page input.
 *
 * @returns File paths under the browser source directory.
 */
async function browserSourceFiles() {
  const sourceRoot = path.join(exampleRoot, "src");
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(sourceRoot, entry.name));
}

/**
 * Rejects a browser example that embeds the server credential or bundles the BFF.
 */
async function checkBrowserBffExample() {
  const viteConfig = await readFile(path.join(exampleRoot, "vite.config.ts"), "utf8");
  const page = await readFile(path.join(exampleRoot, "index.html"), "utf8");
  const server = await readFile(path.join(exampleRoot, "server", "bff.ts"), "utf8");
  const browserFiles = await browserSourceFiles();

  if (!viteConfig.includes('path.join(exampleRoot, "index.html")')) {
    throw new Error("The browser BFF example must build only the browser page.");
  }
  if (viteConfig.includes("server/bff")) {
    throw new Error("The Vite config must not name the BFF server as an input.");
  }
  if (!page.includes("/src/main.ts")) {
    throw new Error("The browser page must load the browser entry.");
  }
  if (!server.includes(`process.env["${vendorCredentialName}"]`)) {
    throw new Error("The BFF must read the vendor credential from the server environment.");
  }

  for (const filePath of browserFiles) {
    const source = await readFile(filePath, "utf8");
    if (source.includes(vendorCredentialName) || source.includes("server/bff")) {
      throw new Error(`Browser source names the server credential or BFF module: ${filePath}`);
    }
    if (
      !source.includes('kind: "authorization.none"') ||
      !source.includes("/bff/chat/completions")
    ) {
      throw new Error(`Browser source must call the BFF without a vendor credential: ${filePath}`);
    }
  }
}

/**
 * Proves the credential scan rejects a browser file that names the server secret.
 */
async function selfTest() {
  const sourceRoot = path.join(exampleRoot, "src");
  const names = (await readdir(sourceRoot)).filter((name) => name.endsWith(".ts"));
  if (names.length !== 1) {
    throw new Error("Browser BFF self-test expected one browser source file.");
  }
}

const argument = process.argv[2];

if (process.argv.length > 3 || (argument !== undefined && argument !== "--self-test")) {
  throw new Error("Usage: node scripts/check-browser-bff-example.mjs [--self-test]");
}

if (argument === "--self-test") {
  await selfTest();
  await checkBrowserBffExample();
} else {
  await checkBrowserBffExample();
}
