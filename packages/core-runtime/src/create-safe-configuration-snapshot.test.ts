// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  SecretValue,
  type CompatibilityMode,
  type ServiceAccess,
} from "@evolutos/mconet-core-domain";

import { createSafeConfigurationSnapshot } from "./create-safe-configuration-snapshot.js";
import type { ResolvedInteractionConfiguration } from "./resolved-interaction-configuration.js";
import type { SafeConfigurationSnapshot } from "./safe-configuration-snapshot.js";

describe("createSafeConfigurationSnapshot", () => {
  // Exercise the exact public signature, full projection, absence semantics,
  // sensitive-source isolation, source-copy behavior, and result immutability.
  it("defines the exact resolved-configuration mapper signature", () => {
    // The mapper accepts one complete configuration and exposes only the safe
    // snapshot type, without a generic escape hatch or mutable result.
    expectTypeOf(createSafeConfigurationSnapshot).parameters.toEqualTypeOf<
      [configuration: ResolvedInteractionConfiguration]
    >();
    expectTypeOf(
      createSafeConfigurationSnapshot,
    ).returns.toEqualTypeOf<SafeConfigurationSnapshot>();
  });

  it("projects every allowlisted scalar into a frozen snapshot", () => {
    const controller = new AbortController();
    const configuration: ResolvedInteractionConfiguration = {
      target: {
        serviceId: "service.example",
        protocolId: "protocol.example",
        model: {
          name: "model-example",
          metadata: { ignored: true },
          extensions: { "example/model": "ignored" },
        },
        deploymentId: "deployment-example",
        extensions: { "example/target": "ignored" },
      },
      serviceAccess: {
        endpoint: { kind: "absolute", value: "https://models.example.test" },
        authorization: { kind: "authorization.example" },
        headers: [],
        query: [],
        extensions: {},
      },
      compatibilityPolicy: { mode: "strict" },
      resourceLimits: {
        maxResponseBodyBytes: 1_024,
        maxStreamingErrorBodyBytes: 512,
        maxFrameBytes: 256,
      },
      signal: controller.signal,
    };

    const snapshot = createSafeConfigurationSnapshot(configuration);

    // Exact values and key order prove projection uses the reviewed allowlist;
    // freezing prevents consumers from changing the recorded observation.
    expect(snapshot).toEqual({
      serviceId: "service.example",
      protocolId: "protocol.example",
      modelName: "model-example",
      deploymentId: "deployment-example",
      authorizationKind: "authorization.example",
      compatibilityMode: "strict",
      maxResponseBodyBytes: 1_024,
      maxStreamingErrorBodyBytes: 512,
      maxFrameBytes: 256,
      hasServiceAccess: true,
      hasSignal: true,
    });
    expect(Object.keys(snapshot)).toEqual([
      "serviceId",
      "protocolId",
      "modelName",
      "deploymentId",
      "authorizationKind",
      "compatibilityMode",
      "maxResponseBodyBytes",
      "maxStreamingErrorBodyBytes",
      "maxFrameBytes",
      "hasServiceAccess",
      "hasSignal",
    ]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Reflect.set(snapshot, "modelName", "replacement-model")).toBe(false);
  });

  it("preserves explicit absence without inventing source data", () => {
    const configuration: ResolvedInteractionConfiguration = {
      target: {
        serviceId: "service.example",
        protocolId: "protocol.example",
        model: { name: "model-example", metadata: {}, extensions: {} },
        extensions: {},
      },
      serviceAccess: undefined,
      compatibilityPolicy: { mode: "compatible" },
      resourceLimits: {
        maxResponseBodyBytes: 1_024,
        maxStreamingErrorBodyBytes: 512,
        maxFrameBytes: 256,
      },
      signal: undefined,
    };
    const snapshotWithoutAccess = createSafeConfigurationSnapshot(configuration);
    const snapshotWithoutAuthorization = createSafeConfigurationSnapshot({
      ...configuration,
      serviceAccess: {
        headers: [],
        query: [],
        extensions: {},
      },
    });

    // Optional source fields become explicit undefined values or booleans, so
    // monitoring can distinguish access absence from access without authorization.
    expect(Object.hasOwn(snapshotWithoutAccess, "deploymentId")).toBe(true);
    expect(snapshotWithoutAccess.deploymentId).toBeUndefined();
    expect(Object.hasOwn(snapshotWithoutAccess, "authorizationKind")).toBe(true);
    expect(snapshotWithoutAccess.authorizationKind).toBeUndefined();
    expect(snapshotWithoutAccess.hasServiceAccess).toBe(false);
    expect(snapshotWithoutAccess.hasSignal).toBe(false);
    expect(snapshotWithoutAuthorization.authorizationKind).toBeUndefined();
    expect(snapshotWithoutAuthorization.hasServiceAccess).toBe(true);
  });

  it("does not read or serialize sensitive and non-allowlisted fields", () => {
    const sensitiveText = ["sensitive", "-", "test", "-", "value"].join("");
    const secret = new SecretValue(sensitiveText);
    const credentialRead = vi.fn((): never => {
      // Throw if the mapper touches scheme-specific authorization payload.
      throw new Error("credential payload must remain unread");
    });
    const authorization = {
      kind: "authorization.example",
      get credential(): SecretValue {
        // Record any forbidden access before failing closed.
        return credentialRead();
      },
      storedCredential: secret,
    };
    const serviceAccess: ServiceAccess = {
      endpoint: {
        kind: "absolute",
        value: `https://models.example.test?access=${sensitiveText}`,
      },
      authorization,
      headers: [{ name: "x-private-value", value: sensitiveText }],
      query: [{ name: "private", value: sensitiveText }],
      extensions: { "example/private": sensitiveText },
    };
    const configuration: ResolvedInteractionConfiguration = {
      target: {
        serviceId: "service.example",
        protocolId: "protocol.example",
        model: {
          name: "model-example",
          metadata: { private: sensitiveText },
          extensions: { "example/private": sensitiveText },
        },
        extensions: { "example/private": sensitiveText },
      },
      serviceAccess,
      compatibilityPolicy: { mode: "compatible" },
      resourceLimits: {
        maxResponseBodyBytes: 1_024,
        maxStreamingErrorBodyBytes: 512,
        maxFrameBytes: 256,
      },
      signal: new AbortController().signal,
    };

    const snapshot = createSafeConfigurationSnapshot(configuration);
    const serializedSnapshot = JSON.stringify(snapshot);

    // Only authorization.kind is read. Neither an enumerable accessor nor any
    // plaintext stored elsewhere in access or target data reaches the result.
    expect(credentialRead).not.toHaveBeenCalled();
    expect(serializedSnapshot).not.toContain(sensitiveText);
    expect(serializedSnapshot).not.toContain("[REDACTED]");
    expect(snapshot.authorizationKind).toBe("authorization.example");
  });

  it("copies primitive leaves into independent snapshots", () => {
    const target = {
      serviceId: "service.initial",
      protocolId: "protocol.initial",
      model: { name: "model-initial", metadata: {}, extensions: {} },
      deploymentId: "deployment-initial",
      extensions: {},
    };
    const authorization = { kind: "authorization.initial" };
    const serviceAccess: ServiceAccess = {
      authorization,
      headers: [],
      query: [],
      extensions: {},
    };
    const compatibilityPolicy: { mode: CompatibilityMode } = { mode: "strict" };
    const resourceLimits = {
      maxResponseBodyBytes: 1_024,
      maxStreamingErrorBodyBytes: 512,
      maxFrameBytes: 256,
    };
    const configuration: ResolvedInteractionConfiguration = {
      target,
      serviceAccess,
      compatibilityPolicy,
      resourceLimits,
      signal: undefined,
    };

    const first = createSafeConfigurationSnapshot(configuration);
    const second = createSafeConfigurationSnapshot(configuration);

    // Mutate structurally compatible source objects after both calls. Each
    // frozen snapshot must retain its copied scalars and have a distinct identity.
    target.serviceId = "service.changed";
    target.model.name = "model-changed";
    authorization.kind = "authorization.changed";
    compatibilityPolicy.mode = "permissive";
    resourceLimits.maxResponseBodyBytes = 2_048;

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.serviceId).toBe("service.initial");
    expect(first.modelName).toBe("model-initial");
    expect(first.authorizationKind).toBe("authorization.initial");
    expect(first.compatibilityMode).toBe("strict");
    expect(first.maxResponseBodyBytes).toBe(1_024);
  });
});
