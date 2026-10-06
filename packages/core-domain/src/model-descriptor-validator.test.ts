// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { isModelDescriptor, type ModelDescriptor } from "./model-descriptor.js";
import { NamedModel } from "./named-model.js";

describe("isModelDescriptor", () => {
  it("accepts the minimal structural descriptor and the default class", () => {
    const structuralDescriptor = {
      name: "",
      metadata: {},
      extensions: {},
    };
    const namedModel = new NamedModel("model-name");

    // The public contract constrains name to a string but declares no syntax or
    // length grammar; both structural and class implementations remain valid.
    expect(isModelDescriptor(structuralDescriptor)).toBe(true);
    expect(isModelDescriptor(namedModel)).toBe(true);
  });

  it("accepts optional fields and nested JSON maps", () => {
    const descriptor = {
      name: "vendor/model-v2",
      displayName: "Vendor Model",
      family: "vendor.text",
      version: "v2",
      metadata: {
        contextWindow: 128_000,
        enabled: false,
        aliases: ["model-latest", null],
        limits: {
          requests: 0,
        },
      },
      extensions: {
        "vendor.routing": {
          regions: ["global"],
        },
      },
    };

    expect(isModelDescriptor(descriptor)).toBe(true);
  });

  it("narrows unknown input to ModelDescriptor", () => {
    const candidate: unknown = {
      name: "model-name",
      metadata: {},
      extensions: {},
    };

    if (!isModelDescriptor(candidate)) {
      throw new Error("Expected the model descriptor test value to be valid.");
    }

    // Assignment proves the boolean result carries the intended type predicate.
    const descriptor: ModelDescriptor = candidate;
    expect(descriptor.name).toBe("model-name");
  });

  it("allows unknown top-level fields without consulting them", () => {
    const unknownGetter = vi.fn(() => {
      throw new Error("unknown getter must not run");
    });
    const descriptor = {
      name: "model-name",
      metadata: {},
      extensions: {},
      futureOption: {
        enabled: true,
      },
      get applicationState(): never {
        return unknownGetter();
      },
    };

    // Structural forward compatibility permits extra fields, while descriptor
    // inspection avoids executing an unknown accessor or using it for control.
    expect(isModelDescriptor(descriptor)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
    expect(descriptor.futureOption).toEqual({ enabled: true });
  });

  it.each([undefined, null, true, 1, "model", [], () => undefined])(
    "rejects the non-object descriptor %j",
    (candidate) => {
      expect(isModelDescriptor(candidate)).toBe(false);
    },
  );

  it("rejects missing, inherited, accessor, or non-string names", () => {
    const inheritedName = Object.assign(Object.create({ name: "inherited" }) as object, {
      metadata: {},
      extensions: {},
    });
    const accessorName = {
      get name(): string {
        throw new Error("name getter must not run");
      },
      metadata: {},
      extensions: {},
    };

    // Required values must be own data properties and validation must not invoke
    // an accessor merely to learn that the candidate is invalid.
    expect(isModelDescriptor({ metadata: {}, extensions: {} })).toBe(false);
    expect(isModelDescriptor(inheritedName)).toBe(false);
    expect(isModelDescriptor(accessorName)).toBe(false);
    expect(isModelDescriptor({ name: 1, metadata: {}, extensions: {} })).toBe(false);
  });

  it("rejects missing or non-record metadata and extensions", () => {
    const validBase = { name: "model-name" };

    expect(isModelDescriptor({ ...validBase, extensions: {} })).toBe(false);
    expect(isModelDescriptor({ ...validBase, metadata: {} })).toBe(false);
    expect(isModelDescriptor({ ...validBase, metadata: null, extensions: {} })).toBe(false);
    expect(isModelDescriptor({ ...validBase, metadata: [], extensions: {} })).toBe(false);
    expect(isModelDescriptor({ ...validBase, metadata: {}, extensions: [] })).toBe(false);
    expect(isModelDescriptor({ ...validBase, metadata: new Date(), extensions: {} })).toBe(false);
  });

  it.each([
    ["displayName", undefined],
    ["displayName", 1],
    ["family", undefined],
    ["family", "invalid family"],
    ["version", undefined],
    ["version", false],
  ] as const)("rejects the invalid optional %s value %j", (key, value) => {
    const descriptor = {
      name: "model-name",
      metadata: {},
      extensions: {},
      [key]: value,
    };

    // Exact optional semantics accept absence, not a present undefined or a
    // value outside the declared string/open-identifier contract.
    expect(isModelDescriptor(descriptor)).toBe(false);
  });

  it.each([
    undefined,
    1n,
    Symbol("metadata"),
    () => undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -0,
  ])("rejects the non-JSON metadata value %s", (invalidValue) => {
    const descriptor = {
      name: "model-name",
      metadata: { invalidValue },
      extensions: {},
    };

    expect(isModelDescriptor(descriptor)).toBe(false);
  });

  it("rejects cycles, accessors, hidden members, symbol keys, and sparse arrays", () => {
    const cyclicMetadata: Record<string, unknown> = {};
    cyclicMetadata.self = cyclicMetadata;
    const accessorMetadata = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => "unsafe",
    });
    const hiddenMetadata = Object.defineProperty({}, "value", {
      enumerable: false,
      value: "hidden",
    });
    const symbolMetadata = { [Symbol("hidden")]: true };
    const sparseArray = new Array<unknown>(1);

    // Every case is representable as a JavaScript object but not as the strict
    // getter-free JSON tree required by metadata and extensions.
    for (const metadata of [
      cyclicMetadata,
      accessorMetadata,
      hiddenMetadata,
      symbolMetadata,
      { values: sparseArray },
    ]) {
      expect(isModelDescriptor({ name: "model-name", metadata, extensions: {} })).toBe(false);
    }
  });

  it("accepts null-prototype maps and ordinary prototype-sensitive keys", () => {
    const metadata = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(metadata, "__proto__", {
      enumerable: true,
      value: { safe: true },
      writable: true,
    });
    metadata.constructor = "ordinary-data";

    // These names remain own data keys; validation neither assigns them to a
    // target object nor invokes Object.prototype setters.
    expect(isModelDescriptor({ name: "model-name", metadata, extensions: {} })).toBe(true);
  });

  it("contains descriptor and nested Proxy failures", () => {
    const descriptorProxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error("descriptor failure");
        },
      },
    );
    const metadataProxy = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error("metadata failure");
        },
      },
    );
    const revokedDescriptor = Proxy.revocable({}, {});
    const revokedMetadata = Proxy.revocable({}, {});
    revokedDescriptor.revoke();
    revokedMetadata.revoke();

    expect(isModelDescriptor(descriptorProxy)).toBe(false);
    expect(isModelDescriptor(revokedDescriptor.proxy)).toBe(false);
    expect(isModelDescriptor({ name: "model-name", metadata: metadataProxy, extensions: {} })).toBe(
      false,
    );
    expect(
      isModelDescriptor({
        name: "model-name",
        metadata: revokedMetadata.proxy,
        extensions: {},
      }),
    ).toBe(false);
  });

  it("does not mutate valid descriptor data", () => {
    const descriptor = {
      name: "model-name",
      metadata: {
        enabled: false,
        count: 0,
        values: [] as unknown[],
      },
      extensions: {},
    };
    const original = structuredClone(descriptor);

    expect(isModelDescriptor(descriptor)).toBe(true);
    expect(descriptor).toEqual(original);
  });

  it("exposes the intended type-guard signature", () => {
    expectTypeOf(isModelDescriptor).toEqualTypeOf<(value: unknown) => value is ModelDescriptor>();
  });
});
