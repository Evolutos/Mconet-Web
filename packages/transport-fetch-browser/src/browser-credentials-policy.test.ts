// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { resolveBrowserCredentials } from "./browser-credentials-policy.js";
import type { BrowserFetchCredentials } from "./browser-fetch-transport-options.js";

/** Value text that must not enter a configuration error. */
const secretValue = "credential-secret-value";

it("defaults browser credentials to omit", () => {
  expect(resolveBrowserCredentials({})).toBe("omit");
  expect(resolveBrowserCredentials({ redirect: "manual" })).toBe("omit");
  expect(resolveBrowserCredentials({ credentials: "omit" })).toBe("omit");
});

it("keeps an explicit credential mode", () => {
  const modes: readonly BrowserFetchCredentials[] = ["include", "omit", "same-origin"];

  for (const mode of modes) {
    expect(resolveBrowserCredentials({ credentials: mode })).toBe(mode);
  }
});

it("rejects an unknown credential mode without copying it", () => {
  const options = { credentials: secretValue } as unknown as {
    credentials: BrowserFetchCredentials;
  };

  expect(() => resolveBrowserCredentials(options)).toThrow(
    expect.objectContaining({
      name: "ModelInteractionError",
      category: "invalid_component_configuration",
      phase: "transport",
      code: "invalid_credentials",
      message: "Browser Fetch credential mode is not supported.",
    }),
  );

  try {
    resolveBrowserCredentials(options);
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain(secretValue);
    expect(JSON.stringify(error)).not.toContain(secretValue);
  }
});
