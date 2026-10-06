// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { CompatibilityMode, OpenIdentifier, SecretValue } from "@evolutos/mconet-core-domain";

import type { SafeConfigurationSnapshot } from "./safe-configuration-snapshot.js";

it("defines the exact non-sensitive configuration summary", () => {
  // Exact equality prevents later additions from silently exposing source
  // configuration objects through this security boundary.
  expectTypeOf<SafeConfigurationSnapshot>().toEqualTypeOf<
    Readonly<{
      serviceId: OpenIdentifier;
      protocolId: OpenIdentifier;
      modelName: string;
      deploymentId: string | undefined;
      authorizationKind: OpenIdentifier | undefined;
      compatibilityMode: CompatibilityMode;
      maxResponseBodyBytes: number;
      maxStreamingErrorBodyBytes: number;
      maxFrameBytes: number;
      hasServiceAccess: boolean;
      hasSignal: boolean;
    }>
  >();
});

it("has no field for sensitive configuration objects or values", () => {
  type ForbiddenField = Extract<
    keyof SafeConfigurationSnapshot,
    | "authorization"
    | "credential"
    | "credentialSource"
    | "endpoint"
    | "headers"
    | "query"
    | "serviceAccess"
    | "signal"
  >;
  type SnapshotValue = SafeConfigurationSnapshot[keyof SafeConfigurationSnapshot];

  // The key check excludes authorization, access, endpoint, request metadata,
  // and cancellation objects. The value check separately excludes SecretValue
  // from every top-level field exposed by the snapshot.
  expectTypeOf<ForbiddenField>().toEqualTypeOf<never>();
  expectTypeOf<SecretValue>().not.toMatchTypeOf<SnapshotValue>();
});

it("represents explicit absence without retaining source objects", () => {
  const snapshot: SafeConfigurationSnapshot = {
    serviceId: "service.example",
    protocolId: "protocol.example",
    modelName: "model-example",
    deploymentId: undefined,
    authorizationKind: undefined,
    compatibilityMode: "compatible",
    maxResponseBodyBytes: 1_024,
    maxStreamingErrorBodyBytes: 512,
    maxFrameBytes: 256,
    hasServiceAccess: false,
    hasSignal: false,
  };

  // Explicit undefined and boolean summaries preserve relevant configuration
  // state without making the omitted access or signal objects reachable.
  expect(Object.hasOwn(snapshot, "deploymentId")).toBe(true);
  expect(Object.hasOwn(snapshot, "authorizationKind")).toBe(true);
  expect(snapshot.maxResponseBodyBytes).toBe(1_024);
  expect(snapshot.maxStreamingErrorBodyBytes).toBe(512);
  expect(snapshot.maxFrameBytes).toBe(256);
  expect(snapshot.hasServiceAccess).toBe(false);
  expect(snapshot.hasSignal).toBe(false);
});

it("prevents replacement of every snapshot field", () => {
  const proveReadonly = (snapshot: SafeConfigurationSnapshot): void => {
    // Exercise invalid writes only during type checking. This helper is never
    // invoked and therefore cannot mutate an actual monitoring snapshot.
    // @ts-expect-error Service identity is immutable snapshot data.
    snapshot.serviceId = "replacement.service";
    // @ts-expect-error Protocol identity is immutable snapshot data.
    snapshot.protocolId = "replacement.protocol";
    // @ts-expect-error Model identity is immutable snapshot data.
    snapshot.modelName = "replacement-model";
    // @ts-expect-error Deployment state cannot be replaced.
    snapshot.deploymentId = undefined;
    // @ts-expect-error Authorization metadata cannot be replaced.
    snapshot.authorizationKind = undefined;
    // @ts-expect-error Compatibility mode cannot be replaced.
    snapshot.compatibilityMode = "strict";
    // @ts-expect-error Unary response limit cannot be replaced.
    snapshot.maxResponseBodyBytes = 1;
    // @ts-expect-error Streaming error limit cannot be replaced.
    snapshot.maxStreamingErrorBodyBytes = 1;
    // @ts-expect-error Frame limit cannot be replaced.
    snapshot.maxFrameBytes = 1;
    // @ts-expect-error Access presence cannot be replaced.
    snapshot.hasServiceAccess = false;
    // @ts-expect-error Signal presence cannot be replaced.
    snapshot.hasSignal = false;
  };

  // Retain the compile-time helper without executing its intentional writes.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("rejects authorization payload and secret fields on object literals", () => {
  const rejectAuthorization = (): SafeConfigurationSnapshot => ({
    serviceId: "service.example",
    protocolId: "protocol.example",
    modelName: "model-example",
    deploymentId: undefined,
    authorizationKind: "authorization.example",
    compatibilityMode: "compatible",
    maxResponseBodyBytes: 1_024,
    maxStreamingErrorBodyBytes: 512,
    maxFrameBytes: 256,
    hasServiceAccess: true,
    hasSignal: false,
    // The safe type exposes only authorizationKind, never the open payload.
    // @ts-expect-error Authorization payloads cannot enter the safe snapshot.
    authorization: { kind: "authorization.example" },
  });
  const rejectSecret = (): SafeConfigurationSnapshot => ({
    serviceId: "service.example",
    protocolId: "protocol.example",
    modelName: "model-example",
    deploymentId: undefined,
    authorizationKind: undefined,
    compatibilityMode: "compatible",
    maxResponseBodyBytes: 1_024,
    maxStreamingErrorBodyBytes: 512,
    maxFrameBytes: 256,
    hasServiceAccess: false,
    hasSignal: false,
    // SecretValue has no field in the exact snapshot object contract.
    // @ts-expect-error Secret values cannot enter the safe snapshot.
    secret: undefined as unknown as SecretValue,
  });

  // Type-check both negative examples without constructing unsafe snapshots.
  expectTypeOf(rejectAuthorization).toBeFunction();
  expectTypeOf(rejectSecret).toBeFunction();
});
