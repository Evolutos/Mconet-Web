// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Diagnostic } from "./diagnostic.js";
import type { InteractionPhase } from "./interaction-phase.js";
import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";
import type { SecretValue } from "./secret-value.js";

it("defines the complete immutable diagnostic shape", () => {
  expectTypeOf<Diagnostic>().toEqualTypeOf<{
    readonly code: string;
    readonly severity: "info" | "warning" | "error";
    readonly phase: InteractionPhase;
    readonly message: string;
    readonly path?: string;
    readonly serviceId?: OpenIdentifier;
    readonly details?: JsonValue;
  }>();
});

it("allows required fields without optional diagnostic context", () => {
  const diagnostic: Diagnostic = {
    code: "unsupported_input",
    severity: "error",
    phase: "validation",
    message: "The input cannot be processed.",
  };

  expect(diagnostic).toEqual({
    code: "unsupported_input",
    severity: "error",
    phase: "validation",
    message: "The input cannot be processed.",
  });
});

it("accepts platform-neutral JSON details and optional locations", () => {
  const diagnostic: Diagnostic = {
    code: "fallback_applied",
    severity: "warning",
    phase: "response_parsing",
    message: "A compatible value was selected.",
    path: "/choices/0/content",
    serviceId: "example.service",
    details: {
      candidates: ["text", "json"],
      selected: "text",
      exact: false,
      confidence: null,
    },
  };

  expect(diagnostic.details).toEqual({
    candidates: ["text", "json"],
    selected: "text",
    exact: false,
    confidence: null,
  });
});

it("excludes non-JSON and secret detail values at compile time", () => {
  expectTypeOf<Diagnostic["details"]>().toEqualTypeOf<JsonValue | undefined>();
  expectTypeOf<Date>().not.toMatchTypeOf<NonNullable<Diagnostic["details"]>>();
  expectTypeOf<Uint8Array>().not.toMatchTypeOf<NonNullable<Diagnostic["details"]>>();
  expectTypeOf<() => void>().not.toMatchTypeOf<NonNullable<Diagnostic["details"]>>();
  expectTypeOf<SecretValue>().not.toMatchTypeOf<NonNullable<Diagnostic["details"]>>();
});

it("prevents diagnostic fields from being replaced at compile time", () => {
  const proveReadonly = (diagnostic: Diagnostic): void => {
    // Exercise representative required and optional assignments solely for
    // compile-time verification; the helper is never invoked at runtime.
    // @ts-expect-error Diagnostic identity cannot be replaced.
    diagnostic.code = "changed";
    // @ts-expect-error Diagnostic severity cannot be replaced.
    diagnostic.severity = "info";
    // @ts-expect-error Structured details cannot be replaced.
    diagnostic.details = null;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
