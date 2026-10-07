// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { isGenerationParameters, type GenerationParameters } from "./generation-parameters.js";

describe("isGenerationParameters", () => {
  it("accepts omission and all protocol-neutral boundary values", () => {
    const complete = {
      temperature: 0,
      topP: 1,
      maxOutputTokens: Number.MAX_SAFE_INTEGER,
      stop: ["\n", "END", "END"],
      seed: Number.MIN_SAFE_INTEGER,
    };

    // Omission does not create defaults. Inclusive numeric boundaries, exact
    // whitespace stops, and duplicate ordered stops remain representable.
    expect(isGenerationParameters({})).toBe(true);
    expect(isGenerationParameters({ topP: 0 })).toBe(true);
    expect(isGenerationParameters({ maxOutputTokens: 1 })).toBe(true);
    expect(isGenerationParameters({ seed: Number.MAX_SAFE_INTEGER })).toBe(true);
    expect(isGenerationParameters(complete)).toBe(true);
    expect(complete.stop).toEqual(["\n", "END", "END"]);
  });

  it("accepts a null-prototype configuration record", () => {
    const parameters = Object.assign(Object.create(null) as object, {
      temperature: 0.5,
    });

    // A null prototype is a portable dictionary representation and introduces
    // no class behavior or inherited parameter values.
    expect(isGenerationParameters(parameters)).toBe(true);
  });

  it("does not impose a provider-specific temperature ceiling", () => {
    const parameters = { temperature: Number.MAX_VALUE };

    // The domain boundary proves finite non-negative temperature only. A target
    // adapter later decides whether its provider supports the supplied value.
    expect(isGenerationParameters(parameters)).toBe(true);
    expect(parameters.temperature).toBe(Number.MAX_VALUE);
  });

  it.each([undefined, null, true, 1, "parameters", [], () => undefined])(
    "rejects the non-record parameters value %j",
    (candidate) => {
      // Generation controls always use a named configuration object.
      expect(isGenerationParameters(candidate)).toBe(false);
    },
  );

  it.each([new Date(), new Map(), /parameters/u, new Uint8Array()])(
    "rejects the non-record object %j",
    (candidate) => {
      // Host and collection instances cannot masquerade as an empty optional
      // configuration merely because they own none of the five control names.
      expect(isGenerationParameters(candidate)).toBe(false);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, -0, "0.7"])(
    "rejects the invalid temperature %j",
    (temperature) => {
      // Temperature must be an exact finite non-negative primitive number.
      expect(isGenerationParameters({ temperature })).toBe(false);
    },
  );

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -0.1,
    -0,
    1.000_001,
    "0.9",
  ])("rejects the invalid top-p value %j", (topP) => {
    // Nucleus probability is closed over zero and one without coercion.
    expect(isGenerationParameters({ topP })).toBe(false);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    -0,
    0,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    "128",
  ])("rejects the invalid maximum output-token count %j", (maxOutputTokens) => {
    // Token limits are positive whole counts that remain exact across JSON SDKs.
    expect(isGenerationParameters({ maxOutputTokens })).toBe(false);
  });

  it("requires a non-empty dense ordinary stop array of non-empty strings", () => {
    const sparse = new Array<string>(1);
    const getter = vi.fn(() => {
      // Throw if validation invokes an indexed accessor instead of inspecting it.
      throw new Error("stop getter must not run");
    });
    const accessor = ["END"];
    Object.defineProperty(accessor, "0", { enumerable: true, get: getter });
    const subclass = new (class StopList extends Array<string> {})("END");
    const cases: readonly unknown[] = ["END", [], [""], ["END", 1], sparse, accessor, subclass];

    // Ordinary dense storage provides deterministic order and prevents hidden
    // getters, holes, subclasses, or coercible members from crossing the boundary.
    for (const stop of cases) {
      expect(isGenerationParameters({ stop })).toBe(false);
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -0,
    1.5,
    Number.MIN_SAFE_INTEGER - 1,
    Number.MAX_SAFE_INTEGER + 1,
    "42",
  ])("rejects the invalid deterministic seed %j", (seed) => {
    // A signed seed is valid only when it is a canonical exactly stored integer.
    expect(isGenerationParameters({ seed })).toBe(false);
  });

  it("rejects explicit undefined inherited and accessor-backed controls", () => {
    const temperatureGetter = vi.fn(() => {
      // Throw if a declared accessor is executed during descriptor validation.
      throw new Error("temperature getter must not run");
    });
    const stopGetter = vi.fn(() => {
      // Throw if the ordered collection property is read through an accessor.
      throw new Error("stop getter must not run");
    });
    const accessor = Object.defineProperty({}, "temperature", {
      enumerable: true,
      get: temperatureGetter,
    });
    const stopAccessor = Object.defineProperty({}, "stop", {
      enumerable: true,
      get: stopGetter,
    });
    const inherited = Object.create({ topP: 0.5 }) as object;

    // Exact optional semantics distinguish absence from an owned undefined.
    // A custom prototype is rejected rather than silently hiding its controls.
    expect(isGenerationParameters({ temperature: undefined })).toBe(false);
    expect(isGenerationParameters(accessor)).toBe(false);
    expect(isGenerationParameters(stopAccessor)).toBe(false);
    expect(isGenerationParameters(inherited)).toBe(false);
    expect(temperatureGetter).not.toHaveBeenCalled();
    expect(stopGetter).not.toHaveBeenCalled();
  });

  it("allows unknown fields without consulting them", () => {
    const unknownGetter = vi.fn(() => {
      // Throw if validation interprets application-owned extension state.
      throw new Error("unknown getter must not run");
    });
    const parameters = {
      temperature: 0.5,
      futureControl: true,
      get applicationState(): never {
        // Route a forbidden read through the spy so execution is observable.
        return unknownGetter();
      },
    };

    // Structural openness depends only on the five standard control fields.
    expect(isGenerationParameters(parameters)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
    expect(parameters.futureControl).toBe(true);
  });

  it("contains Proxy failures and leaves accepted input unchanged", () => {
    const outerProxy = new Proxy(
      {},
      {
        ownKeys: () => {
          // Simulate failure while reflecting the configuration envelope.
          throw new Error("outer failure");
        },
      },
    );
    const stopProxy = new Proxy(["END"], {
      getPrototypeOf: () => {
        // Simulate failure while classifying a nested stop collection.
        throw new Error("stop failure");
      },
    });
    const prototypeProxy = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          // Simulate failure after the outer descriptor snapshot succeeds.
          throw new Error("prototype failure");
        },
      },
    );
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const parameters = {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 512,
      stop: ["END", "\nUser:"],
      seed: 42,
    };
    const original = structuredClone(parameters);

    // Hostile reflection fails closed. Successful validation performs no trim,
    // clamp, default, sort, deduplication, freezing, copying, or caller mutation.
    expect(isGenerationParameters(outerProxy)).toBe(false);
    expect(isGenerationParameters(prototypeProxy)).toBe(false);
    expect(isGenerationParameters({ stop: stopProxy })).toBe(false);
    expect(isGenerationParameters(revoked.proxy)).toBe(false);
    expect(isGenerationParameters(parameters)).toBe(true);
    expect(parameters).toEqual(original);
  });

  it("exposes the intended generation-parameter type-guard signature", () => {
    // Lock the public validator to a reusable unknown-input predicate.
    expectTypeOf(isGenerationParameters).toEqualTypeOf<
      (value: unknown) => value is GenerationParameters
    >();
  });
});
