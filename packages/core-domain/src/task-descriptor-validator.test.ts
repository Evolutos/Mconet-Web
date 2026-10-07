// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { isTaskDescriptor, type TaskDescriptor } from "./task-descriptor.js";

describe("isTaskDescriptor", () => {
  it("accepts the minimal descriptor and narrows unknown input", () => {
    const candidate: unknown = {
      type: "conversation.generate",
      metadata: {},
      extensions: {},
    };

    // The three required own fields form the smallest complete descriptor; all
    // version and Schema identities preserve true absence.
    expect(isTaskDescriptor(candidate)).toBe(true);
    if (!isTaskDescriptor(candidate)) {
      throw new Error("Expected the task descriptor test value to be valid.");
    }

    // Assignment proves successful validation narrows unknown to TaskDescriptor.
    const descriptor: TaskDescriptor = candidate;
    expect(descriptor.type).toBe("conversation.generate");
    expect("version" in descriptor).toBe(false);
  });

  it("accepts an open task type and all optional descriptor fields", () => {
    const descriptor = {
      type: "vendor.document_compare",
      version: "future-version",
      inputSchemaId: "schema.vendor.document_pair",
      outputSchemaId: "schema.vendor.comparison_result",
      metadata: {
        language: "zh-CN",
        stable: false,
        limits: [0, null],
      },
      extensions: {
        "vendor.options": {
          explainDifferences: true,
        },
      },
    };

    // Open identity and opaque strings remain exact; no registry lookup, SemVer
    // parsing, URI parsing, normalization, or vocabulary restriction occurs.
    expect(isTaskDescriptor(descriptor)).toBe(true);
    expect(descriptor.version).toBe("future-version");
    expect(descriptor.inputSchemaId).toBe("schema.vendor.document_pair");
    expect(descriptor.outputSchemaId).toBe("schema.vendor.comparison_result");
  });

  it.each([undefined, null, true, 1, "task", [], () => undefined])(
    "rejects the non-object descriptor %j",
    (candidate) => {
      // A descriptor must be a non-array object with named own data fields.
      expect(isTaskDescriptor(candidate)).toBe(false);
    },
  );

  it("rejects missing inherited accessor-backed and invalid task types", () => {
    const inheritedType = Object.assign(Object.create({ type: "vendor.inherited" }) as object, {
      metadata: {},
      extensions: {},
    });
    const typeGetter = vi.fn(() => {
      // Throw if validation reads an accessor rather than inspecting it.
      throw new Error("type getter must not run");
    });
    const accessorType = {
      get type(): never {
        // Route a forbidden read through the spy so the test observes it.
        return typeGetter();
      },
      metadata: {},
      extensions: {},
    };

    // Task identity is required as an own data property and must satisfy the
    // same open identifier grammar used by all cross-SDK identities.
    expect(isTaskDescriptor({ metadata: {}, extensions: {} })).toBe(false);
    expect(isTaskDescriptor(inheritedType)).toBe(false);
    expect(isTaskDescriptor(accessorType)).toBe(false);
    expect(typeGetter).not.toHaveBeenCalled();
    for (const type of ["", ".vendor", "vendor..task", "vendor task", 1]) {
      expect(isTaskDescriptor({ type, metadata: {}, extensions: {} })).toBe(false);
    }
  });

  it("validates optional version without parsing or normalization", () => {
    for (const version of ["1.0", "future-version", " v2 "]) {
      const descriptor = {
        type: "conversation.generate",
        version,
        metadata: {},
        extensions: {},
      };

      // Nonblank opaque text is accepted exactly, including surrounding spaces;
      // validation only detects blank content and never rewrites storage.
      expect(isTaskDescriptor(descriptor)).toBe(true);
      expect(descriptor.version).toBe(version);
    }

    for (const version of ["", " \t\n", undefined, 1, false]) {
      expect(
        isTaskDescriptor({
          type: "conversation.generate",
          version,
          metadata: {},
          extensions: {},
        }),
      ).toBe(false);
    }
  });

  it("validates both optional Schema identities independently", () => {
    const base = {
      type: "conversation.generate",
      metadata: {},
      extensions: {},
    };

    // Schema IDs are independent opaque strings at this boundary. Empty content
    // remains a string and any stronger registry grammar belongs to its consumer.
    expect(isTaskDescriptor({ ...base, inputSchemaId: "schema.input" })).toBe(true);
    expect(isTaskDescriptor({ ...base, outputSchemaId: "schema.output" })).toBe(true);
    expect(isTaskDescriptor({ ...base, inputSchemaId: "", outputSchemaId: "" })).toBe(true);
    expect(isTaskDescriptor({ ...base, inputSchemaId: undefined })).toBe(false);
    expect(isTaskDescriptor({ ...base, outputSchemaId: 1 })).toBe(false);
  });

  it("rejects missing or invalid metadata and extensions", () => {
    const base = { type: "conversation.generate" };

    // Both portable channels are required own JSON records and cannot be arrays,
    // host objects, explicit undefined, or records containing non-JSON values.
    expect(isTaskDescriptor({ ...base, extensions: {} })).toBe(false);
    expect(isTaskDescriptor({ ...base, metadata: {} })).toBe(false);
    expect(isTaskDescriptor({ ...base, metadata: [], extensions: {} })).toBe(false);
    expect(isTaskDescriptor({ ...base, metadata: {}, extensions: new Date() })).toBe(false);
    expect(isTaskDescriptor({ ...base, metadata: { invalid: undefined }, extensions: {} })).toBe(
      false,
    );
    expect(isTaskDescriptor({ ...base, metadata: {}, extensions: { invalid: Number.NaN } })).toBe(
      false,
    );
  });

  it("rejects cycles accessors symbol keys and sparse arrays in JSON maps", () => {
    const cyclicMetadata: Record<string, unknown> = {};
    cyclicMetadata.self = cyclicMetadata;
    const metadataGetter = vi.fn(() => {
      // Throw if recursive JSON validation executes an accessor value.
      throw new Error("metadata getter must not run");
    });
    const accessorMetadata = Object.defineProperty({}, "unsafe", {
      enumerable: true,
      get: metadataGetter,
    });
    const symbolMetadata = { [Symbol("hidden")]: true };
    const sparseArray = new Array<unknown>(1);
    const base = { type: "conversation.generate", extensions: {} };

    // JavaScript can represent each value, but none belongs to the strict,
    // accessor-free and dense portable JSON subset used by domain contracts.
    for (const metadata of [
      cyclicMetadata,
      accessorMetadata,
      symbolMetadata,
      { values: sparseArray },
    ]) {
      expect(isTaskDescriptor({ ...base, metadata })).toBe(false);
    }
    expect(metadataGetter).not.toHaveBeenCalled();
  });

  it("allows unknown top-level fields without consulting them", () => {
    const unknownGetter = vi.fn(() => {
      // Throw if validation begins interpreting application-owned state.
      throw new Error("unknown getter must not run");
    });
    const descriptor = {
      type: "vendor.document_compare",
      metadata: {},
      extensions: {},
      futureOption: { enabled: true },
      get applicationState(): never {
        // Route a forbidden read through the spy so the test observes it.
        return unknownGetter();
      },
    };

    // Structural openness retains extra fields while validator control flow
    // depends only on the declared descriptor surface.
    expect(isTaskDescriptor(descriptor)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
    expect(descriptor.futureOption).toEqual({ enabled: true });
  });

  it("contains descriptor and nested Proxy failures", () => {
    const descriptorProxy = new Proxy(
      {},
      {
        ownKeys: () => {
          // Simulate a hostile reflection boundary at the descriptor level.
          throw new Error("descriptor failure");
        },
      },
    );
    const metadataProxy = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          // Simulate hostile behavior during nested JSON map inspection.
          throw new Error("metadata failure");
        },
      },
    );
    const revokedDescriptor = Proxy.revocable({}, {});
    const revokedMetadata = Proxy.revocable({}, {});
    revokedDescriptor.revoke();
    revokedMetadata.revoke();

    // Every reflective failure becomes false rather than escaping the public
    // predicate as an unnormalized runtime exception.
    expect(isTaskDescriptor(descriptorProxy)).toBe(false);
    expect(isTaskDescriptor(revokedDescriptor.proxy)).toBe(false);
    expect(
      isTaskDescriptor({
        type: "conversation.generate",
        metadata: metadataProxy,
        extensions: {},
      }),
    ).toBe(false);
    expect(
      isTaskDescriptor({
        type: "conversation.generate",
        metadata: revokedMetadata.proxy,
        extensions: {},
      }),
    ).toBe(false);
  });

  it("does not mutate valid descriptor data", () => {
    const descriptor = {
      type: "vendor.document_compare",
      version: "future-version",
      inputSchemaId: "schema.input",
      metadata: {
        enabled: false,
        count: 0,
        values: [] as unknown[],
      },
      extensions: {},
    };
    const original = structuredClone(descriptor);

    // A predicate may inspect but never trim, normalize, freeze, copy, or write
    // caller-owned descriptor data as a validation side effect.
    expect(isTaskDescriptor(descriptor)).toBe(true);
    expect(descriptor).toEqual(original);
  });

  it("exposes the intended type-guard signature", () => {
    // Lock the public function to a reusable unknown-input type predicate.
    expectTypeOf(isTaskDescriptor).toEqualTypeOf<(value: unknown) => value is TaskDescriptor>();
  });
});
