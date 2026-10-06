// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type { Diagnostic } from "./diagnostic.js";
import type { JsonValue } from "./json-value.js";
import { ModelInteractionError } from "./model-interaction-error.js";
import { SecretValue } from "./secret-value.js";
import { serializeModelInteractionError } from "./serialize-model-interaction-error.js";

it("serializes reviewed required and optional error fields", () => {
  const error = new ModelInteractionError({
    message: "The service is temporarily unavailable.",
    category: "model_service",
    phase: "transport",
    code: "service_unavailable",
    statusCode: 503,
    serviceErrorCode: "temporarily_unavailable",
    requestId: "request-17",
    recovery: {
      transient: true,
      retryAfterMilliseconds: 1_500,
      requestMayHaveBeenProcessed: false,
    },
    diagnostics: [],
  });

  expect(serializeModelInteractionError(error)).toEqual({
    name: "ModelInteractionError",
    message: "The service is temporarily unavailable.",
    category: "model_service",
    phase: "transport",
    code: "service_unavailable",
    statusCode: 503,
    serviceErrorCode: "temporarily_unavailable",
    requestId: "request-17",
    recovery: {
      transient: true,
      retryAfterMilliseconds: 1_500,
      requestMayHaveBeenProcessed: false,
    },
    diagnostics: [],
  });
});

it("omits cause and stack without inspecting a secret-bearing cause", () => {
  const plaintext = "test-credential";
  const secret = new SecretValue(plaintext);
  const dangerousGetter = vi.fn(() => {
    throw new Error("cause getter must not run");
  });
  const cause = Object.defineProperty({ secret }, "dangerous", {
    enumerable: true,
    get: dangerousGetter,
  });
  const error = new ModelInteractionError({
    message: `Authorization failed for ${secret}`,
    category: "authentication",
    phase: "authorization",
    code: "credential_rejected",
    diagnostics: [],
    cause,
  });

  const serialized = serializeModelInteractionError(error);
  const json = JSON.stringify(serialized);

  expect(serialized).not.toHaveProperty("cause");
  expect(serialized).not.toHaveProperty("stack");
  expect(json).toContain("[REDACTED]");
  expect(json).not.toContain(plaintext);
  expect(dangerousGetter).not.toHaveBeenCalled();
});

it("redacts secret wrappers and fails closed for unsafe diagnostic details", () => {
  const plaintext = "test-credential";
  const accessor = vi.fn(() => plaintext);
  const cyclicDetails: Record<string, unknown> = {
    secret: new SecretValue(plaintext),
    nonFinite: Number.POSITIVE_INFINITY,
    platformValue: new Date(0),
  };
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  cyclicDetails.revokedProxy = revoked.proxy;
  Object.defineProperty(cyclicDetails, "accessor", {
    enumerable: true,
    get: accessor,
  });
  cyclicDetails.self = cyclicDetails;

  const forgedDiagnostic: Diagnostic = {
    code: "unsafe_details",
    severity: "warning",
    phase: "response_parsing",
    message: "Unsafe details were replaced.",
    details: cyclicDetails as JsonValue,
  };
  const error = new ModelInteractionError({
    message: "Response parsing produced diagnostics.",
    category: "protocol",
    phase: "response_parsing",
    code: "unsafe_diagnostic_details",
    diagnostics: [forgedDiagnostic],
  });

  const json = JSON.stringify(serializeModelInteractionError(error));

  expect(json).toContain("[REDACTED]");
  expect(json).toContain("[CIRCULAR]");
  expect(json).toContain("[UNSERIALIZABLE]");
  expect(json).not.toContain(plaintext);
  expect(accessor).not.toHaveBeenCalled();
});

it("returns frozen snapshots with the public serializer signature", () => {
  const error = new ModelInteractionError({
    message: "Invalid input.",
    category: "invalid_request",
    phase: "validation",
    code: "invalid_input",
    diagnostics: [],
  });

  const serialized = serializeModelInteractionError(error);

  expect(Object.isFrozen(serialized)).toBe(true);
  expect(Object.isFrozen(serialized.diagnostics)).toBe(true);
  expectTypeOf(serializeModelInteractionError).toEqualTypeOf<
    (error: ModelInteractionError) => Readonly<Record<string, JsonValue>>
  >();
});
