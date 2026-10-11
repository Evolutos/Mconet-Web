// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import { assertSupportedBodySigningMode } from "./assert-supported-body-signing-mode.js";

/** Mode text that must not be copied into the failure. */
const rejectedMode = "buffered_digest:signing-secret";

it("accepts the none body-signing mode", () => {
  expect(assertSupportedBodySigningMode("none")).toBeUndefined();
});

it("rejects every other body-signing mode with one stable error", () => {
  for (const bodySigningMode of [rejectedMode, "None", "", undefined, null, 1, { mode: "hmac" }]) {
    try {
      assertSupportedBodySigningMode(bodySigningMode);
      expect.fail("unsupported body signing must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ModelInteractionError);
      expect(error).toMatchObject({
        category: "unsupported_feature",
        phase: "authorization",
        code: "unsupported_body_signing",
        diagnostics: [
          {
            code: "unsupported_body_signing",
            severity: "error",
            phase: "authorization",
          },
        ],
      });
      expect(String(error)).not.toContain(rejectedMode);
      expect(JSON.stringify(error)).not.toContain(rejectedMode);
    }
  }
});
