// Copyright © 2026 Mcont.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Directory that receives minified bundles and their module lists. */
const bundleRoot = path.join(workspaceRoot, ".artifacts", "browser-bundle-size");

/**
 * Workspace packages the public browser client may contain.
 *
 * The Node Fetch package is omitted on purpose. Resolving it would mean the
 * browser entry imported a Node transport.
 */
const browserPackages = [
  "auth-basic",
  "codec-json",
  "core-domain",
  "core-runtime",
  "core-spi",
  "integration-openai-compatible",
  "transport-fetch-browser",
  "transport-fetch-shared",
];

/**
 * Resolves a workspace package from its source entry.
 *
 * Source aliases keep the size build off `dist`, so a Node export condition
 * cannot select the Node Fetch transport.
 *
 * @param {string} packageRole Package directory name.
 * @returns {string} Absolute source entry.
 */
function packageEntry(packageRole) {
  return path.join(workspaceRoot, "packages", packageRole, "src", "index.ts");
}

/**
 * Records the module graph next to the bundle.
 *
 * The size report reads this list. Minified output hides import paths, so the
 * graph has to be captured while the bundler still knows each module id.
 *
 * @param {string} bundleName Bundle label used as the file name.
 * @returns {import("vite").Plugin} Vite plugin that writes the module list.
 */
function recordModules(bundleName) {
  return {
    name: `record-${bundleName}-modules`,
    generateBundle() {
      mkdirSync(bundleRoot, { recursive: true });
      writeFileSync(
        path.join(bundleRoot, `${bundleName}-modules.json`),
        `${JSON.stringify([...this.getModuleIds()])}\n`,
      );
    },
  };
}

/**
 * Vite settings shared by the three size-baseline builds.
 *
 * Minification is on because the recorded baseline is the shipped bundle size,
 * not the readable development bundle.
 *
 * @param {string} bundleName Bundle label used for the output directory.
 * @param {string} entry Absolute source entry.
 * @param {{ find: string, replacement: string }[]} alias Package source aliases.
 * @returns {import("vite").UserConfig} One library build.
 */
function bundleConfig(bundleName, entry, alias) {
  return {
    configFile: false,
    logLevel: "error",
    plugins: [recordModules(bundleName)],
    resolve: { alias },
    build: {
      emptyOutDir: true,
      lib: {
        entry,
        fileName: "index",
        formats: ["es"],
      },
      minify: true,
      outDir: path.join(bundleRoot, bundleName),
      sourcemap: false,
    },
  };
}

/** Source aliases for the named workspace packages. */
function aliases(packageRoles) {
  return packageRoles.map((packageRole) => ({
    find: `@evolutos/mconet-${packageRole}`,
    replacement: packageEntry(packageRole),
  }));
}

/**
 * One minified library build selected by `MCONET_BUNDLE`.
 *
 * Vite 8 loads a single config object. The size report sets the variable once
 * per bundle: the public browser entry, core, and the default integration.
 * The browser entry re-exports the default integration, so that code is part
 * of the browser measurement and is also measured alone.
 */
const bundleConfigs = {
  browser: bundleConfig(
    "browser",
    path.join(workspaceRoot, "packages", "client", "src", "browser.ts"),
    aliases(browserPackages),
  ),
  core: bundleConfig("core", packageEntry("core-runtime"), aliases(["core-domain", "core-spi"])),
  integration: bundleConfig(
    "integration",
    packageEntry("integration-openai-compatible"),
    aliases(["core-domain", "core-spi"]),
  ),
};

const selectedBundle = process.env.MCONET_BUNDLE ?? "";
const selectedConfig = bundleConfigs[selectedBundle];
if (selectedConfig === undefined) {
  throw new Error("MCONET_BUNDLE must be browser, core, or integration.");
}

export default selectedConfig;
