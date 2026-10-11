// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import {
  browserRedirectForwardsAuthorization,
  resolveBrowserRedirect,
} from "./browser-redirect-policy.js";
import type { BrowserFetchRedirect } from "./browser-fetch-transport-options.js";

/** Value text that must not enter a configuration error. */
const secretValue = "redirect-secret-value";

it("defaults browser redirects to error so authorization is not forwarded", () => {
  const mode = resolveBrowserRedirect({ credentials: "include" });

  expect(mode).toBe("error");
  expect(browserRedirectForwardsAuthorization(mode)).toBe(false);
  expect(browserRedirectForwardsAuthorization(resolveBrowserRedirect({}))).toBe(false);
});

it("accepts manual redirects without forwarding authorization", () => {
  const mode = resolveBrowserRedirect({ redirect: "manual", credentials: "include" });

  expect(mode).toBe("manual");
  expect(browserRedirectForwardsAuthorization(mode)).toBe(false);
  expect(resolveBrowserRedirect({ redirect: "error" })).toBe("error");
});

it("rejects a following redirect without copying the supplied value", () => {
  const options = { redirect: secretValue } as unknown as { redirect: BrowserFetchRedirect };

  expect(() => resolveBrowserRedirect(options)).toThrow(
    expect.objectContaining({
      name: "ModelInteractionError",
      category: "invalid_component_configuration",
      phase: "transport",
      code: "invalid_redirect",
      message: "Browser Fetch redirect mode is not supported.",
    }),
  );

  try {
    resolveBrowserRedirect(options);
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain(secretValue);
    expect(JSON.stringify(error)).not.toContain(secretValue);
  }

  try {
    resolveBrowserRedirect({
      redirect: "follow",
    } as unknown as { redirect: BrowserFetchRedirect });
  } catch (error) {
    expect(String(error)).not.toContain("follow");
  }
});
