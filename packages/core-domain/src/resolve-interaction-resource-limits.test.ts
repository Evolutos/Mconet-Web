// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { InteractionResourceLimits } from "./interaction-resource-limits.js";
import type { ResolvedInteractionResourceLimits } from "./resolved-interaction-resource-limits.js";
import { resolveInteractionResourceLimits } from "./resolve-interaction-resource-limits.js";

const sdkDefaults: ResolvedInteractionResourceLimits = {
  maxResponseBodyBytes: 100,
  maxStreamingErrorBodyBytes: 200,
  maxFrameBytes: 300,
};

describe("resolveInteractionResourceLimits", () => {
  // Exercise the public signature, all precedence tiers, validation boundaries,
  // immutability, and reflection safety as one resolver contract.
  it("defines the exact three-layer resolver signature", () => {
    // Optional positional layers retain distinct documented roles while the
    // complete SDK defaults remain required as the first argument.
    expectTypeOf(resolveInteractionResourceLimits).parameters.toEqualTypeOf<
      [
        sdkDefaults: ResolvedInteractionResourceLimits,
        clientLimits?: InteractionResourceLimits,
        interactionLimits?: InteractionResourceLimits,
      ]
    >();
    expectTypeOf(
      resolveInteractionResourceLimits,
    ).returns.toEqualTypeOf<ResolvedInteractionResourceLimits>();
  });

  it("uses complete SDK defaults when override layers are absent", () => {
    const resolved = resolveInteractionResourceLimits(sdkDefaults);

    // Resolution returns an independent complete value instead of exposing the
    // caller-owned defaults object as shared mutable runtime state.
    expect(resolved).toEqual(sdkDefaults);
    expect(resolved).not.toBe(sdkDefaults);
    expect(Object.isFrozen(resolved)).toBe(true);
  });

  it("applies client overrides independently per field", () => {
    const resolved = resolveInteractionResourceLimits(sdkDefaults, {
      maxResponseBodyBytes: 110,
      maxFrameBytes: 330,
    });

    // The omitted client field falls through to the SDK tier rather than being
    // replaced as a side effect of another field in the same object.
    expect(resolved).toEqual({
      maxResponseBodyBytes: 110,
      maxStreamingErrorBodyBytes: 200,
      maxFrameBytes: 330,
    });
  });

  it("applies interaction overrides independently above client values", () => {
    const resolved = resolveInteractionResourceLimits(
      sdkDefaults,
      {
        maxResponseBodyBytes: 110,
        maxStreamingErrorBodyBytes: 220,
      },
      {
        maxResponseBodyBytes: 111,
        maxFrameBytes: 333,
      },
    );

    // The three fields deliberately resolve from interaction, client, and
    // interaction tiers to prove that whole-object replacement is not used.
    expect(resolved).toEqual({
      maxResponseBodyBytes: 111,
      maxStreamingErrorBodyBytes: 220,
      maxFrameBytes: 333,
    });
  });

  it("treats present empty override layers as no overrides", () => {
    const resolved = resolveInteractionResourceLimits(sdkDefaults, {}, {});

    // Layer presence alone has no precedence effect; an own known field must be
    // present and valid before it can replace a lower-priority value.
    expect(resolved).toEqual(sdkDefaults);
  });

  it("does not mutate any source layer", () => {
    const client: InteractionResourceLimits = { maxResponseBodyBytes: 110 };
    const interaction: InteractionResourceLimits = { maxFrameBytes: 333 };

    resolveInteractionResourceLimits(sdkDefaults, client, interaction);

    // Inputs retain their original partial shapes; resolved values are never
    // written back into reusable client or one-shot interaction configuration.
    expect(sdkDefaults).toEqual({
      maxResponseBodyBytes: 100,
      maxStreamingErrorBodyBytes: 200,
      maxFrameBytes: 300,
    });
    expect(client).toEqual({ maxResponseBodyBytes: 110 });
    expect(interaction).toEqual({ maxFrameBytes: 333 });
  });

  it("returns deterministic values in separate frozen snapshots", () => {
    const first = resolveInteractionResourceLimits(sdkDefaults);
    const second = resolveInteractionResourceLimits(sdkDefaults);

    // Equal inputs produce equal field values, while separate identities prevent
    // state sharing between concurrent interactions.
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(Reflect.set(first, "maxFrameBytes", 999)).toBe(false);
    expect(first.maxFrameBytes).toBe(300);
  });

  it("rejects incomplete SDK defaults", () => {
    const incompleteDefaults = {
      maxResponseBodyBytes: 100,
      maxStreamingErrorBodyBytes: 200,
    } as ResolvedInteractionResourceLimits;

    // The final fallback cannot omit a field, because doing so would create an
    // unresolved or implicitly unlimited result.
    expect(() => {
      // Invoke resolution inside the assertion boundary so the exact fallback
      // completeness failure is observed instead of escaping the test.
      resolveInteractionResourceLimits(incompleteDefaults);
    }).toThrow("sdkDefaults must contain every resource-limit field.");
  });

  it("validates invalid values in every source tier", () => {
    const invalidCalls = [
      () => {
        // Put an invalid value in the required SDK tier.
        resolveInteractionResourceLimits({
          maxResponseBodyBytes: 0,
          maxStreamingErrorBodyBytes: 200,
          maxFrameBytes: 300,
        });
      },
      () => {
        // Put a non-finite value in the reusable client tier.
        resolveInteractionResourceLimits(sdkDefaults, {
          maxStreamingErrorBodyBytes: Number.POSITIVE_INFINITY,
        });
      },
      () => {
        // Put a negative value in the one-shot interaction tier.
        resolveInteractionResourceLimits(sdkDefaults, undefined, { maxFrameBytes: -1 });
      },
    ];

    // Run one invalid case per tier so no argument position can bypass the
    // shared positive-safe-integer contract.
    for (const invalidCall of invalidCalls) {
      expect(invalidCall).toThrow("must be a valid resource-limit object.");
    }
  });

  it("rejects an invalid lower layer even when an interaction value overrides it", () => {
    const client = { maxResponseBodyBytes: 0 } as InteractionResourceLimits;

    // Validation precedes selection, so a correct one-shot value cannot hide a
    // broken reusable client configuration that should fail before I/O.
    expect(() => {
      // Resolve through the higher valid interaction value while retaining the
      // invalid client layer, which must still fail preselection validation.
      resolveInteractionResourceLimits(sdkDefaults, client, {
        maxResponseBodyBytes: 111,
      });
    }).toThrow("clientLimits must be a valid resource-limit object.");
  });

  it("rejects null and non-object override layers passed from JavaScript", () => {
    // TypeScript callers cannot supply these values, but public runtime code can
    // still receive them through JavaScript or an unsafe external cast.
    expect(() => {
      // Pass null through an unsafe cast to exercise the JavaScript boundary.
      resolveInteractionResourceLimits(sdkDefaults, null as unknown as InteractionResourceLimits);
    }).toThrow("clientLimits must be a valid resource-limit object.");
    expect(() => {
      // Pass a primitive interaction layer through the same untyped boundary.
      resolveInteractionResourceLimits(
        sdkDefaults,
        undefined,
        42 as unknown as InteractionResourceLimits,
      );
    }).toThrow("interactionLimits must be a valid resource-limit object.");
  });

  it("does not execute known or unknown getters", () => {
    const knownGetter = vi.fn(() => {
      // Return an otherwise valid number if unsafe code executes this accessor.
      return 110;
    });
    const unknownGetter = vi.fn(() => {
      // Return extension data if unsafe code traverses unrelated properties.
      return "metadata";
    });
    const client = Object.defineProperties(
      {},
      {
        maxResponseBodyBytes: { enumerable: true, get: knownGetter },
        metadata: { enumerable: true, get: unknownGetter },
      },
    ) as InteractionResourceLimits;

    // A known accessor is invalid rather than executable configuration; unknown
    // extension fields remain unobserved during rejection.
    expect(() => {
      // Attempt resolution without directly reading either accessor in the test.
      resolveInteractionResourceLimits(sdkDefaults, client);
    }).toThrow("clientLimits must be a valid resource-limit object.");
    expect(knownGetter).not.toHaveBeenCalled();
    expect(unknownGetter).not.toHaveBeenCalled();
  });

  it("fails closed when a Proxy throws after initial validation", () => {
    let ownKeysCallCount = 0;
    const client = new Proxy(
      { maxFrameBytes: 333 },
      {
        ownKeys(target) {
          // Allow the shared validator to inspect the target once, then model a
          // stateful external object failing during the resolver snapshot.
          ownKeysCallCount += 1;
          if (ownKeysCallCount > 1) {
            throw new Error("state changed");
          }
          return Reflect.ownKeys(target);
        },
      },
    );

    // The resolver converts the second reflection failure into its stable layer
    // diagnostic instead of leaking a native Proxy error or partial values.
    expect(() => {
      // Supply the stateful Proxy only within the throwing assertion boundary.
      resolveInteractionResourceLimits(sdkDefaults, client);
    }).toThrow("clientLimits must be a valid resource-limit object.");
  });

  it("revalidates descriptors captured after initial validation", () => {
    let descriptorCallCount = 0;
    const client = new Proxy(
      {},
      {
        ownKeys() {
          // Expose the same known field in both reflection passes.
          return ["maxFrameBytes"];
        },
        getOwnPropertyDescriptor() {
          // Return a valid first-pass value and an invalid second-pass value to
          // prove the captured snapshot is independently revalidated.
          descriptorCallCount += 1;
          return {
            configurable: true,
            enumerable: true,
            writable: true,
            value: descriptorCallCount === 1 ? 333 : 0,
          };
        },
      },
    ) as InteractionResourceLimits;

    // A source that changes between validation and capture cannot inject an
    // invalid value into the final frozen result.
    expect(() => {
      // Resolve once so the Proxy advances through both descriptor responses.
      resolveInteractionResourceLimits(sdkDefaults, client);
    }).toThrow("clientLimits must be a valid resource-limit object.");
  });

  it("fails closed for revoked Proxy layers", () => {
    const { proxy, revoke } = Proxy.revocable({ maxFrameBytes: 333 }, {});
    revoke();

    // Reflection failures become the same stable layer diagnostic and never
    // expose the Proxy's native error text or continue with partial values.
    expect(() => {
      // Supply the revoked object only within the throwing assertion boundary.
      resolveInteractionResourceLimits(sdkDefaults, proxy as unknown as InteractionResourceLimits);
    }).toThrow("clientLimits must be a valid resource-limit object.");
  });
});
