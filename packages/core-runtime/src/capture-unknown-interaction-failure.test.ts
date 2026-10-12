// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { captureUnknownInteractionFailure } from "./capture-unknown-interaction-failure.js";

it("returns a model interaction error unchanged", () => {
  const error = new ModelInteractionError({
    message: "The request was cancelled.",
    category: "cancelled",
    phase: "transport",
    code: "cancelled",
    diagnostics: [],
  });

  expect(captureUnknownInteractionFailure(error, "decoding")).toBe(error);
});

it("retains an unclassified exception as cause without copying its text", () => {
  const thrown = new Error("secret-stack-text");
  const error = captureUnknownInteractionFailure(thrown, "transport");

  expect(error.code).toBe("unknown_interaction_failure");
  expect(error.category).toBe("unknown");
  expect(error.phase).toBe("transport");
  expect(error.cause).toBe(thrown);
  expect(error.message).not.toMatch(/secret-stack-text/u);
});
