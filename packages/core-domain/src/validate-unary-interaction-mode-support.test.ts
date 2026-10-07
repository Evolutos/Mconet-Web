// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { InteractionMode } from "./interaction-mode.js";
import type { ProcessingResult } from "./processing-result.js";
import { validateUnaryInteractionModeSupport } from "./validate-unary-interaction-mode-support.js";

it("returns the original unary mode without diagnostics", () => {
  const mode: InteractionMode = { id: "unary" };
  const result = validateUnaryInteractionModeSupport(mode);

  // Identity proves the gate does not copy, normalize, freeze, or replace the
  // open value with a built-in singleton.
  expect(result).toEqual({ value: mode, diagnostics: [] });
  expect(result.value).toBe(mode);
});

it.each(["server_stream", "client_stream", "duplex", "long_running", "vendor.batch"])(
  "rejects the unsupported mode %s with one stable diagnostic",
  (modeId) => {
    const mode: InteractionMode = { id: modeId };
    const result = validateUnaryInteractionModeSupport(mode);

    // Every standard or integration-defined non-unary identity follows the same
    // deterministic failure contract and never produces a usable mode value.
    expect(result).toEqual({
      diagnostics: [
        {
          code: "unsupported_interaction_mode",
          severity: "error",
          phase: "validation",
          message: "Only unary interaction mode is supported by this execution path.",
          path: "id",
          details: {
            modeId,
            supportedModeId: "unary",
          },
        },
      ],
    });
    expect(Object.hasOwn(result, "value")).toBe(false);
  },
);

it("does not inspect unknown mode fields or infer from transport data", () => {
  let transportReadCount = 0;
  const mode = {
    id: "vendor.stream_over_http",
    get transportKind(): never {
      // Throw if the mode gate tries to infer support from transport metadata.
      transportReadCount += 1;
      throw new Error("transportKind must not be read");
    },
    taskType: "conversation.generate",
    unary: true,
  } as InteractionMode;

  // Open object fields remain untouched and cannot override the authoritative
  // mode id, even when their names or values suggest unary execution.
  expect(() => validateUnaryInteractionModeSupport(mode)).not.toThrow();
  expect(validateUnaryInteractionModeSupport(mode).diagnostics[0]?.code).toBe(
    "unsupported_interaction_mode",
  );
  expect(transportReadCount).toBe(0);
});

it("returns deterministic independent failure envelopes", () => {
  const mode: InteractionMode = { id: "server_stream" };
  const first = validateUnaryInteractionModeSupport(mode);
  const second = validateUnaryInteractionModeSupport(mode);

  // Equal diagnostic data is freshly allocated, so consumers cannot alter a
  // later validation through shared array or result state.
  expect(first).toEqual(second);
  expect(first).not.toBe(second);
  expect(first.diagnostics).not.toBe(second.diagnostics);
});

it("exposes one narrow open-mode processing signature", () => {
  // The input remains InteractionMode rather than a unary-only subtype so this
  // gate can produce a meaningful unsupported-mode result.
  expectTypeOf(validateUnaryInteractionModeSupport).toEqualTypeOf<
    (mode: InteractionMode) => ProcessingResult<InteractionMode>
  >();
});
