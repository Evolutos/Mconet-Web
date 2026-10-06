// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import type { Diagnostic } from "./diagnostic.js";
import { ModelInteractionError } from "./model-interaction-error.js";

const diagnostic: Diagnostic = {
  code: "invalid_payload",
  severity: "error",
  phase: "decoding",
  message: "The response payload is invalid.",
};

describe("ModelInteractionError", () => {
  it("creates a classified Error with all required fields", () => {
    const error = new ModelInteractionError({
      message: "Unable to decode the model response.",
      category: "deserialization",
      phase: "decoding",
      code: "invalid_response_payload",
      diagnostics: [diagnostic],
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ModelInteractionError);
    expect(error.name).toBe("ModelInteractionError");
    expect(error.message).toBe("Unable to decode the model response.");
    expect(error.category).toBe("deserialization");
    expect(error.phase).toBe("decoding");
    expect(error.code).toBe("invalid_response_payload");
    expect(error.diagnostics).toEqual([diagnostic]);
  });

  it("preserves every supplied optional field and an unknown cause", () => {
    const cause = { source: "provider", value: 17 };
    const recovery = {
      transient: true,
      retryAfterMilliseconds: 1_500,
      requestMayHaveBeenProcessed: false,
    } as const;
    const error = new ModelInteractionError({
      message: "The service is temporarily unavailable.",
      category: "model_service",
      phase: "transport",
      code: "service_unavailable",
      statusCode: 503,
      serviceErrorCode: "temporarily_unavailable",
      requestId: "request-17",
      recovery,
      diagnostics: [],
      cause,
    });

    expect(error.statusCode).toBe(503);
    expect(error.serviceErrorCode).toBe("temporarily_unavailable");
    expect(error.requestId).toBe("request-17");
    expect(error.recovery).toBe(recovery);
    expect(error.cause).toBe(cause);
    expectTypeOf(error.cause).toEqualTypeOf<unknown>();
  });

  it("omits unknown optional fields and uses native non-enumerable cause semantics", () => {
    const withoutCause = new ModelInteractionError({
      message: "Invalid input.",
      category: "invalid_request",
      phase: "validation",
      code: "invalid_input",
      diagnostics: [],
    });
    const withCause = new ModelInteractionError({
      message: "Transport failed.",
      category: "network",
      phase: "transport",
      code: "connection_failed",
      diagnostics: [],
      cause: "socket closed",
    });

    expect(Object.hasOwn(withoutCause, "statusCode")).toBe(false);
    expect(Object.hasOwn(withoutCause, "serviceErrorCode")).toBe(false);
    expect(Object.hasOwn(withoutCause, "requestId")).toBe(false);
    expect(Object.hasOwn(withoutCause, "recovery")).toBe(false);
    expect(Object.hasOwn(withoutCause, "cause")).toBe(false);
    expect(Object.getOwnPropertyDescriptor(withCause, "cause")).toMatchObject({
      enumerable: false,
      value: "socket closed",
    });
  });

  it("captures and freezes a diagnostic collection snapshot", () => {
    const sourceDiagnostics: Diagnostic[] = [diagnostic];
    const error = new ModelInteractionError({
      message: "Unable to decode the model response.",
      category: "deserialization",
      phase: "decoding",
      code: "invalid_response_payload",
      diagnostics: sourceDiagnostics,
    });

    sourceDiagnostics.length = 0;

    expect(error.diagnostics).toEqual([diagnostic]);
    expect(Object.isFrozen(error.diagnostics)).toBe(true);
  });

  it("prevents structured error fields from being replaced at compile time", () => {
    const proveReadonly = (error: ModelInteractionError): void => {
      // Exercise required, optional, collection, and cause assignments solely for
      // compile-time verification; the helper is never invoked at runtime.
      // @ts-expect-error Error classification cannot be replaced.
      error.category = "unknown";
      // @ts-expect-error Optional status metadata cannot be replaced.
      error.statusCode = 500;
      // @ts-expect-error The diagnostic snapshot cannot be replaced.
      error.diagnostics = [];
      // @ts-expect-error The original cause cannot be replaced.
      error.cause = new Error("replacement");
    };

    expectTypeOf(proveReadonly).toBeFunction();
  });
});
