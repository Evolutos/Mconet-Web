// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { isModelTarget, type ModelTarget } from "./model-target.js";

describe("isModelTarget", () => {
  // Exercise valid, invalid, hostile, and type-level boundary behavior as one
  // cohesive contract suite for the public predicate.
  it("accepts the minimal target and narrows unknown input", () => {
    const candidate: unknown = {
      serviceId: "vendor.service",
      protocolId: "vendor.protocol",
      model: {
        name: "model-name",
        metadata: {},
        extensions: {},
      },
      extensions: {},
    };

    // The minimal contract omits only the optional deployment identifier while
    // retaining all four required stored fields.
    expect(isModelTarget(candidate)).toBe(true);
    if (!isModelTarget(candidate)) {
      throw new Error("Expected the model target test value to be valid.");
    }

    // Assignment proves the successful boolean result narrows to ModelTarget.
    const target: ModelTarget = candidate;
    expect(target.protocolId).toBe("vendor.protocol");
  });

  it("accepts a deployment identifier, nested model data, and target extensions", () => {
    const target = {
      serviceId: "gateway.service",
      protocolId: "openai.chat.completions",
      model: {
        name: "vendor/model-v2",
        family: "vendor.text",
        metadata: {
          contextWindow: 128_000,
        },
        extensions: {
          "vendor.model": {
            enabled: true,
          },
        },
      },
      deploymentId: "deployment-blue",
      extensions: {
        "vendor.routing": {
          regions: ["global"],
        },
      },
    };

    // Each nested value exercises its own validator without coupling service,
    // protocol, model, deployment, or extension identity. Deployment is an opaque
    // string, so both a provider value and the empty string remain valid.
    expect(isModelTarget(target)).toBe(true);
    expect(isModelTarget({ ...target, deploymentId: "" })).toBe(true);
  });

  it.each([
    undefined,
    null,
    true,
    1,
    "target",
    [],
    () => {
      // Supply a callable non-object candidate without adding observable work.
      return undefined;
    },
  ])("rejects the non-object target %j", (candidate) => {
    // A ModelTarget is always a non-array object with named own properties.
    expect(isModelTarget(candidate)).toBe(false);
  });

  it.each(["serviceId", "protocolId", "model", "extensions"] as const)(
    "rejects a missing %s field",
    (field) => {
      const candidate: Record<string, unknown> = {
        serviceId: "vendor.service",
        protocolId: "vendor.protocol",
        model: {
          name: "model-name",
          metadata: {},
          extensions: {},
        },
        extensions: {},
      };

      // Delete exactly one required own property so each contract requirement is
      // verified independently instead of failing through an unrelated field.
      expect(Reflect.deleteProperty(candidate, field)).toBe(true);
      expect(isModelTarget(candidate)).toBe(false);
    },
  );

  it.each([
    ["serviceId", ""],
    ["serviceId", ".vendor"],
    ["serviceId", "vendor service"],
    ["serviceId", 1],
    ["protocolId", ""],
    ["protocolId", "vendor..protocol"],
    ["protocolId", "vendor\nprotocol"],
    ["protocolId", false],
  ] as const)("rejects the invalid %s value %j", (field, invalidValue) => {
    const candidate = {
      serviceId: "vendor.service" as unknown,
      protocolId: "vendor.protocol" as unknown,
      model: {
        name: "model-name",
        metadata: {},
        extensions: {},
      },
      extensions: {},
      [field]: invalidValue,
    };

    // Both identity fields delegate to the same open-identifier grammar without
    // trimming, coercion, or model-name-based inference.
    expect(isModelTarget(candidate)).toBe(false);
  });

  it("rejects inherited and accessor-backed required fields without running getters", () => {
    const inheritedService = Object.assign(
      Object.create({ serviceId: "inherited.service" }) as object,
      {
        protocolId: "vendor.protocol",
        model: {
          name: "model-name",
          metadata: {},
          extensions: {},
        },
        extensions: {},
      },
    );
    const serviceGetter = vi.fn(() => {
      // Throw if validation accidentally reads through the accessor boundary.
      throw new Error("serviceId getter must not run");
    });
    const accessorService = {
      get serviceId(): never {
        // Route a forbidden read through the spy so the test observes it.
        return serviceGetter();
      },
      protocolId: "vendor.protocol",
      model: {
        name: "model-name",
        metadata: {},
        extensions: {},
      },
      extensions: {},
    };

    // Required values must be own data properties, and reflection must not invoke
    // the accessor merely to establish that the target is invalid.
    expect(isModelTarget(inheritedService)).toBe(false);
    expect(isModelTarget(accessorService)).toBe(false);
    expect(serviceGetter).not.toHaveBeenCalled();
  });

  it("delegates nested model validation", () => {
    const baseTarget = {
      serviceId: "vendor.service",
      protocolId: "vendor.protocol",
      extensions: {},
    };

    // Invalid nested descriptors cannot become valid merely because their target
    // identities are well formed.
    expect(isModelTarget({ ...baseTarget, model: {} })).toBe(false);
    expect(
      isModelTarget({
        ...baseTarget,
        model: {
          name: "model-name",
          family: "invalid family",
          metadata: {},
          extensions: {},
        },
      }),
    ).toBe(false);
  });

  it.each([undefined, 1, false, {}, []])(
    "rejects the present invalid deployment identifier %j",
    (deploymentId) => {
      const target = {
        serviceId: "vendor.service",
        protocolId: "vendor.protocol",
        model: {
          name: "model-name",
          metadata: {},
          extensions: {},
        },
        deploymentId,
        extensions: {},
      };

      // Exact optional semantics distinguish an absent deployment from a present
      // value outside the declared string contract.
      expect(isModelTarget(target)).toBe(false);
    },
  );

  it("rejects an accessor-backed deployment without running its getter", () => {
    const deploymentGetter = vi.fn(() => {
      // Throw if an optional accessor is evaluated instead of inspected.
      throw new Error("deploymentId getter must not run");
    });
    const target = {
      serviceId: "vendor.service",
      protocolId: "vendor.protocol",
      model: {
        name: "model-name",
        metadata: {},
        extensions: {},
      },
      get deploymentId(): never {
        // Route a forbidden read through the spy so the test observes it.
        return deploymentGetter();
      },
      extensions: {},
    };

    // Optional properties use the same own-data boundary as required fields when
    // they are explicitly present.
    expect(isModelTarget(target)).toBe(false);
    expect(deploymentGetter).not.toHaveBeenCalled();
  });

  it.each([undefined, null, [], new Date(), { invalid: undefined }])(
    "rejects the invalid target extensions %j",
    (extensions) => {
      const target = {
        serviceId: "vendor.service",
        protocolId: "vendor.protocol",
        model: {
          name: "model-name",
          metadata: {},
          extensions: {},
        },
        extensions,
      };

      // Extensions must remain an ordinary JSON record rather than an arbitrary
      // JavaScript object or a coercible substitute.
      expect(isModelTarget(target)).toBe(false);
    },
  );

  it("rejects cyclic and accessor-backed target extensions", () => {
    const cyclicExtensions: Record<string, unknown> = {};
    cyclicExtensions.self = cyclicExtensions;
    const extensionGetter = vi.fn(() => {
      // Throw if recursive JSON validation executes an extension accessor.
      throw new Error("extension getter must not run");
    });
    const accessorExtensions = Object.defineProperty({}, "unsafe", {
      enumerable: true,
      get: extensionGetter,
    });
    const baseTarget = {
      serviceId: "vendor.service",
      protocolId: "vendor.protocol",
      model: {
        name: "model-name",
        metadata: {},
        extensions: {},
      },
    };

    // JSON validation rejects cycles and accessors while guaranteeing that the
    // accessor body never executes.
    expect(isModelTarget({ ...baseTarget, extensions: cyclicExtensions })).toBe(false);
    expect(isModelTarget({ ...baseTarget, extensions: accessorExtensions })).toBe(false);
    expect(extensionGetter).not.toHaveBeenCalled();
  });

  it("allows unknown top-level fields without consulting them", () => {
    const unknownGetter = vi.fn(() => {
      // Throw if validation begins interpreting an undeclared application field.
      throw new Error("unknown getter must not run");
    });
    const target = {
      serviceId: "vendor.service",
      protocolId: "vendor.protocol",
      model: {
        name: "model-name",
        metadata: {},
        extensions: {},
      },
      extensions: {},
      futureOption: {
        enabled: true,
      },
      get applicationState(): never {
        // Route a forbidden read through the spy so the test observes it.
        return unknownGetter();
      },
    };

    // Structural forward compatibility permits application fields, while target
    // validation neither executes nor interprets unknown accessors.
    expect(isModelTarget(target)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
    expect(target.futureOption).toEqual({ enabled: true });
  });

  it("contains target and nested Proxy failures", () => {
    const targetProxy = new Proxy(
      {},
      {
        ownKeys: () => {
          // Simulate a hostile reflection boundary at the target level.
          throw new Error("target failure");
        },
      },
    );
    const extensionProxy = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          // Simulate a hostile reflection boundary inside target extensions.
          throw new Error("extension failure");
        },
      },
    );
    const revokedTarget = Proxy.revocable({}, {});
    revokedTarget.revoke();
    const validModel = {
      name: "model-name",
      metadata: {},
      extensions: {},
    };

    // Reflection failures at either target or extension depth fail closed rather
    // than escaping as unnormalized runtime exceptions.
    expect(isModelTarget(targetProxy)).toBe(false);
    expect(isModelTarget(revokedTarget.proxy)).toBe(false);
    expect(
      isModelTarget({
        serviceId: "vendor.service",
        protocolId: "vendor.protocol",
        model: validModel,
        extensions: extensionProxy,
      }),
    ).toBe(false);
  });

  it("does not mutate valid target data", () => {
    const target = {
      serviceId: "vendor.service",
      protocolId: "vendor.protocol",
      model: {
        name: "model-name",
        metadata: {
          enabled: false,
        },
        extensions: {},
      },
      deploymentId: "deployment-blue",
      extensions: {
        "vendor.routing": {
          weight: 0,
        },
      },
    };
    const original = structuredClone(target);

    // A predicate may inspect the target but must not normalize, freeze, or write
    // caller-owned data as a side effect.
    expect(isModelTarget(target)).toBe(true);
    expect(target).toEqual(original);
  });

  it("exposes the intended type-guard signature", () => {
    // Lock the public function to a reusable unknown-input type predicate.
    expectTypeOf(isModelTarget).toEqualTypeOf<(value: unknown) => value is ModelTarget>();
  });
});
