// Copyright © 2026 Mcont.

import { readFile } from "node:fs/promises";

import type { TaskProtocolAdapter } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { createDefaultClient as createBrowserClient } from "./browser.js";
import { createDefaultClient as createNodeClient } from "./node.js";

it("selects a different Fetch transport from each platform entry", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as {
    exports: { ".": { browser: string; node: string } };
  };
  const browserSource = await readFile(new URL("./browser.ts", import.meta.url), "utf8");
  const nodeSource = await readFile(new URL("./node.ts", import.meta.url), "utf8");
  const browserClient = await readFile(new URL("./browser-client.ts", import.meta.url), "utf8");
  const nodeClient = await readFile(new URL("./node-client.ts", import.meta.url), "utf8");

  expect(manifest.exports["."].browser).toBe("./dist/browser.js");
  expect(manifest.exports["."].node).toBe("./dist/node.js");
  expect(browserSource).toContain("browser-client.js");
  expect(browserSource).not.toContain("transport-fetch-node");
  expect(browserSource).not.toContain("node-client.js");
  expect(browserClient).toContain("@evolutos/mconet-transport-fetch-browser");
  expect(browserClient).not.toContain("transport-fetch-node");
  expect(nodeSource).toContain("node-client.js");
  expect(nodeSource).not.toContain("transport-fetch-browser");
  expect(nodeSource).not.toContain("browser-client.js");
  expect(nodeClient).toContain("@evolutos/mconet-transport-fetch-node");
  expect(nodeClient).not.toContain("transport-fetch-browser");
  expect(nodeClient).not.toContain("browser-client.js");
  expect(createBrowserClient({ adapter: unusedAdapter() })).toBeDefined();
  expect(createNodeClient({ adapter: unusedAdapter() })).toBeDefined();
});

function unusedAdapter(): TaskProtocolAdapter {
  return {
    descriptor: {
      name: "adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: () => false,
    preparePlan: () => {
      throw new Error("unused");
    },
    buildRequest: () => {
      throw new Error("unused");
    },
    parseResponse: () => {
      throw new Error("unused");
    },
    parseError: () => {
      throw new Error("unused");
    },
  };
}
