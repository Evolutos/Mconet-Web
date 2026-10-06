// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Diagnostic } from "./diagnostic.js";
import type { ProcessingResult } from "./processing-result.js";

it("defines an optional generic value and required immutable diagnostics", () => {
  expectTypeOf<ProcessingResult<number>>().toEqualTypeOf<{
    readonly value?: number;
    readonly diagnostics: readonly Diagnostic[];
  }>();
});

it("represents a value produced without diagnostics", () => {
  const result: ProcessingResult<{ readonly text: string }> = {
    value: { text: "complete" },
    diagnostics: [],
  };

  expect(result).toEqual({
    value: { text: "complete" },
    diagnostics: [],
  });
});

it("represents a value accompanied by non-fatal diagnostics", () => {
  const warning: Diagnostic = {
    code: "fallback_applied",
    severity: "warning",
    phase: "response_parsing",
    message: "A compatible value was selected.",
  };
  const result: ProcessingResult<string> = {
    value: "compatible-value",
    diagnostics: [warning],
  };

  expect(result.value).toBe("compatible-value");
  expect(result.diagnostics).toEqual([warning]);
});

it("represents diagnostics without fabricating a value", () => {
  const failure: Diagnostic = {
    code: "invalid_payload",
    severity: "error",
    phase: "decoding",
    message: "The response payload is invalid.",
  };
  const result: ProcessingResult<never> = {
    diagnostics: [failure],
  };

  expect(Object.hasOwn(result, "value")).toBe(false);
  expect(result.diagnostics).toEqual([failure]);
});

it("prevents value replacement and diagnostic collection mutation at compile time", () => {
  const proveReadonly = (result: ProcessingResult<string>): void => {
    // Exercise property and collection mutation solely for compile-time
    // verification; the helper is intentionally never invoked at runtime.
    // @ts-expect-error A produced value cannot be replaced.
    result.value = "changed";
    // @ts-expect-error The diagnostic collection reference cannot be replaced.
    result.diagnostics = [];
    // @ts-expect-error Readonly diagnostic collections do not expose push.
    result.diagnostics.push({
      code: "changed",
      severity: "info",
      phase: "validation",
      message: "changed",
    });
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
