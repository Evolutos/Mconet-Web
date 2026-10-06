// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it } from "vitest";

import { isArtifact, type Artifact } from "./artifact.js";
import type { ArtifactDescriptor } from "./artifact-descriptor.js";
import type { ArtifactKind } from "./artifact-kind.js";
import type { ArtifactMetadata } from "./artifact-metadata.js";
import type { ArtifactSource } from "./artifact-source.js";
import type { Extensions } from "./extensions.js";
import type { InlineArtifactSource } from "./inline-artifact-source.js";
import type { UriArtifactSource } from "./uri-artifact-source.js";

it("defines only immutable Artifact data boundaries", () => {
  // Exact equality keeps identity, classification, representation, description,
  // metadata, and extensions separate without introducing runtime behavior.
  expectTypeOf<Artifact>().toEqualTypeOf<{
    readonly id: string;
    readonly kind: ArtifactKind;
    readonly mediaType?: string;
    readonly source: ArtifactSource;
    readonly descriptor?: ArtifactDescriptor;
    readonly metadata: ArtifactMetadata;
    readonly extensions: Extensions;
  }>();
});

it("represents a minimal inline Artifact without optional fields", () => {
  const source: InlineArtifactSource = {
    kind: "artifact.source.inline",
    bytes: new Uint8Array(),
  };
  const artifact: Artifact = {
    id: "text-input",
    kind: {
      id: "artifact.text",
      extensions: {},
    },
    source,
    metadata: {},
    extensions: {},
  };

  // Optional fields remain truly absent; the base source does not pretend to
  // read bytes, and the interface does not synthesize media or descriptor data.
  expect(artifact).toEqual({
    id: "text-input",
    kind: {
      id: "artifact.text",
      extensions: {},
    },
    source,
    metadata: {},
    extensions: {},
  });
  expect(Object.hasOwn(artifact, "mediaType")).toBe(false);
  expect(Object.hasOwn(artifact, "descriptor")).toBe(false);
});

it("preserves classification source descriptor metadata and extensions independently", () => {
  const source: UriArtifactSource = {
    kind: "artifact.source.uri",
    uri: {
      kind: "relative",
      value: "assets/image-1.png",
    },
  };
  const artifact: Artifact = {
    id: "provider-image-1",
    kind: {
      id: "provider.design_asset",
      semantic: "image",
      extensions: {
        "provider.kind": { renderable: true },
      },
    },
    mediaType: "image/png",
    source,
    descriptor: {
      kind: "artifact.descriptor.image",
    },
    metadata: {
      featured: false,
      labels: ["preview", "示例"],
    },
    extensions: {
      "provider.artifact": { downloadable: false },
    },
  };

  // Structural extension fields remain attached to their own layer; the base
  // Artifact neither interprets them nor infers behavior from media type text.
  expect(artifact.kind.id).toBe("provider.design_asset");
  expect(artifact.source.kind).toBe("artifact.source.uri");
  expect(artifact.descriptor?.kind).toBe("artifact.descriptor.image");
  expect(artifact.metadata.featured).toBe(false);
  expect(artifact.extensions["provider.artifact"]).toEqual({ downloadable: false });
});

it("requires every non-optional Artifact field", () => {
  // Each missing shape proves no surrounding Catalog or source can supply an
  // implicit identity, classification, metadata, or extension container.
  expectTypeOf<{
    readonly kind: ArtifactKind;
    readonly source: ArtifactSource;
    readonly metadata: ArtifactMetadata;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<Artifact>();
  expectTypeOf<{
    readonly id: string;
    readonly source: ArtifactSource;
    readonly metadata: ArtifactMetadata;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<Artifact>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: ArtifactKind;
    readonly metadata: ArtifactMetadata;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<Artifact>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: ArtifactKind;
    readonly source: ArtifactSource;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<Artifact>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: ArtifactKind;
    readonly source: ArtifactSource;
    readonly metadata: ArtifactMetadata;
  }>().not.toMatchTypeOf<Artifact>();
});

it("keeps optional fields distinct from explicit undefined", () => {
  // exactOptionalPropertyTypes preserves true omission for wire-compatible data
  // instead of accepting present-but-undefined properties.
  expectTypeOf<{
    readonly id: string;
    readonly kind: ArtifactKind;
    readonly mediaType: undefined;
    readonly source: ArtifactSource;
    readonly descriptor: undefined;
    readonly metadata: ArtifactMetadata;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<Artifact>();
});

it("prevents Artifact fields and map entries from being replaced", () => {
  const proveReadonly = (artifact: Artifact): void => {
    // Exercise representative forbidden writes only during compilation; this
    // helper stays reachable below but is never invoked against fixture data.
    // @ts-expect-error Artifact identity cannot be replaced.
    artifact.id = "changed-artifact";
    // @ts-expect-error Artifact classification cannot be replaced.
    artifact.kind = { id: "artifact.unknown", extensions: {} };
    // @ts-expect-error Artifact source cannot be replaced.
    artifact.source = { kind: "artifact.source.inline" };
    // @ts-expect-error Artifact metadata cannot be replaced.
    artifact.metadata = {};
    // @ts-expect-error Individual metadata entries remain readonly.
    artifact.metadata.status = "changed";
    // @ts-expect-error Artifact extensions cannot be replaced.
    artifact.extensions = {};
    // @ts-expect-error Individual extension entries remain readonly.
    artifact.extensions["provider.artifact"] = null;
  };

  // Keep the helper reachable so strict TypeScript checking proves immutable
  // references without executing mutations or Artifact I/O behavior.
  expectTypeOf(proveReadonly).toBeFunction();
});

describe("isArtifact", () => {
  it("accepts a complete inline Artifact without replacing nested values", () => {
    const candidate = createValidArtifactValue();
    const originalKind = candidate.kind;
    const originalSource = candidate.source;
    const originalDescriptor = candidate.descriptor;
    const originalMetadata = candidate.metadata;
    const originalExtensions = candidate.extensions;

    // Successful validation preserves every nested object by identity and never
    // parses the retained media-type string into a replacement value.
    expect(isArtifact(candidate)).toBe(true);
    expect(candidate.kind).toBe(originalKind);
    expect(candidate.source).toBe(originalSource);
    expect(candidate.descriptor).toBe(originalDescriptor);
    expect(candidate.metadata).toBe(originalMetadata);
    expect(candidate.extensions).toBe(originalExtensions);
    expect(candidate.mediaType).toBe("image/png; charset=utf-8");
  });

  it("accepts omitted optional fields and an integration-defined source", () => {
    const candidate = createValidArtifactValue();
    delete candidate.mediaType;
    delete candidate.descriptor;
    candidate.source = {
      kind: "provider.source.stream",
      repeatable: false,
    };

    // Open source kinds retain integration fields without core-domain invoking
    // or assigning meaning to them, while optional fields stay truly absent.
    expect(isArtifact(candidate)).toBe(true);
    expect(Object.hasOwn(candidate, "mediaType")).toBe(false);
    expect(Object.hasOwn(candidate, "descriptor")).toBe(false);
  });

  it.each([
    { kind: "absolute", value: "https://assets.example.invalid/image.png" },
    { kind: "relative", value: "../assets/image.png" },
  ] as const)("accepts a valid $kind URI source without resolving it", (uri) => {
    const candidate = createValidArtifactValue();
    const source = {
      kind: "artifact.source.uri",
      uri,
    };
    candidate.source = source;

    // The validator checks the explicit URI form and leaves absolute or relative
    // text and source-object identity untouched.
    expect(isArtifact(candidate)).toBe(true);
    expect(candidate.source).toBe(source);
    expect(uri.value).toBe(source.uri.value);
  });

  it.each([
    ["id", ""],
    ["id", "artifact id"],
    ["kind", "artifact.image"],
    ["kind", { id: "", extensions: {} }],
    ["kind", { id: "artifact.image" }],
    ["kind", { id: "artifact.image", semantic: undefined, extensions: {} }],
    ["kind", { id: "artifact.image", extensions: { invalid: () => undefined } }],
  ] as const)("rejects invalid %s value %#", (field, invalidValue) => {
    const candidate = createValidArtifactValue();
    candidate[field] = invalidValue;

    // Identity and structured kind validation fail closed without coercing bare
    // strings, invalid identifiers, absent extensions, or executable JSON data.
    expect(isArtifact(candidate)).toBe(false);
  });

  it.each([
    null,
    "artifact.source.inline",
    { kind: "" },
    { kind: "artifact.source.inline" },
    { kind: "artifact.source.inline", bytes: [1, 2, 3] },
    { kind: "artifact.source.uri" },
    { kind: "artifact.source.uri", uri: "https://assets.example.invalid/image.png" },
    { kind: "artifact.source.uri", uri: { kind: "relative", value: "bad path" } },
  ])("rejects invalid Artifact source %#", (invalidSource) => {
    const candidate = createValidArtifactValue();
    candidate.source = invalidSource;

    // Known discriminators require their concrete bytes or UriValue shape;
    // malformed data cannot fall back to the open custom-source path.
    expect(isArtifact(candidate)).toBe(false);
  });

  it.each([undefined, null, 42, "", "image", "image/", "image/png; charset"])(
    "rejects invalid present media type %#",
    (invalidMediaType) => {
      const candidate = createValidArtifactValue();
      candidate.mediaType = invalidMediaType;

      // Present media types must be exact strings with valid syntax; explicit
      // undefined remains different from true property absence.
      expect(isArtifact(candidate)).toBe(false);
    },
  );

  it.each([
    null,
    undefined,
    "artifact.descriptor.image",
    {},
    { kind: "" },
    { kind: "artifact descriptor" },
  ])("rejects invalid present descriptor %#", (invalidDescriptor) => {
    const candidate = createValidArtifactValue();
    candidate.descriptor = invalidDescriptor;

    // A present descriptor must be a record with one valid open kind; exact
    // optional semantics reject null and explicit undefined.
    expect(isArtifact(candidate)).toBe(false);
  });

  it.each(["metadata", "extensions"] as const)(
    "rejects non-JSON and cyclic %s records",
    (field) => {
      const executableCandidate = createValidArtifactValue();
      executableCandidate[field] = { invalid: () => undefined };

      const cyclicRecord: Record<string, unknown> = {};
      // Create a direct cycle deliberately so recursive JSON validation must
      // reject it rather than recurse indefinitely.
      cyclicRecord.self = cyclicRecord;
      const cyclicCandidate = createValidArtifactValue();
      cyclicCandidate[field] = cyclicRecord;

      // Both public data maps use the same finite JSON boundary.
      expect(isArtifact(executableCandidate)).toBe(false);
      expect(isArtifact(cyclicCandidate)).toBe(false);
    },
  );

  it("rejects missing required fields independently", () => {
    for (const field of ["id", "kind", "source", "metadata", "extensions"] as const) {
      const candidate = createValidArtifactValue();
      // Remove one required field from a fresh value so each failure is isolated
      // and no earlier deletion can mask a later requirement.
      expect(Reflect.deleteProperty(candidate, field)).toBe(true);
      expect(isArtifact(candidate)).toBe(false);
    }
  });

  it("rejects accessors without invoking them", () => {
    const sourceCandidate = createValidArtifactValue();
    const descriptorCandidate = createValidArtifactValue();
    let sourceGetterCalls = 0;
    let descriptorGetterCalls = 0;
    Object.defineProperty(sourceCandidate, "source", {
      enumerable: true,
      get() {
        // If invoked, this counter exposes a trust-boundary side effect that the
        // descriptor-based validator is required to avoid.
        sourceGetterCalls += 1;
        return { kind: "provider.source.hostile" };
      },
    });
    Object.defineProperty(descriptorCandidate, "descriptor", {
      enumerable: true,
      get() {
        // Descriptor accessors receive the same fail-closed treatment and must
        // not execute modality-specific user code during validation.
        descriptorGetterCalls += 1;
        return { kind: "artifact.descriptor.image" };
      },
    });

    // Reflection rejects both accessors by descriptor and executes neither body.
    expect(isArtifact(sourceCandidate)).toBe(false);
    expect(isArtifact(descriptorCandidate)).toBe(false);
    expect(sourceGetterCalls).toBe(0);
    expect(descriptorGetterCalls).toBe(0);
  });

  it("contains hostile inline byte brand-check failures", () => {
    const bytes = Proxy.revocable(new Uint8Array([1]), {});
    bytes.revoke();
    const candidate = createValidArtifactValue();
    candidate.source = {
      kind: "artifact.source.inline",
      bytes: bytes.proxy,
    };

    // A revoked Proxy can throw during instanceof; the validator converts that
    // platform failure into an ordinary invalid result.
    expect(() => isArtifact(candidate)).not.toThrow();
    expect(isArtifact(candidate)).toBe(false);
  });

  it("contains revoked Proxy failures at root and nested boundaries", () => {
    const root = Proxy.revocable({}, {});
    root.revoke();
    const nested = Proxy.revocable({}, {});
    nested.revoke();
    const candidate = createValidArtifactValue();
    candidate.source = nested.proxy;

    // Reflection failures are invalid input, not exceptions observable by SDK
    // callers, whether the hostile object is root-level or nested.
    expect(() => isArtifact(root.proxy)).not.toThrow();
    expect(isArtifact(root.proxy)).toBe(false);
    expect(() => isArtifact(candidate)).not.toThrow();
    expect(isArtifact(candidate)).toBe(false);
  });
});

/** Creates fresh valid runtime data for one isolated Artifact validator case. */
function createValidArtifactValue(): Record<string, unknown> {
  // Every call allocates independent nested values so destructive invalid-case
  // edits cannot leak between tests or make their result order-dependent.
  return {
    id: "artifact-image-1",
    kind: {
      id: "artifact.image",
      semantic: "image",
      extensions: {
        "provider.kind": { renderable: true },
      },
    },
    mediaType: "image/png; charset=utf-8",
    source: {
      kind: "artifact.source.inline",
      bytes: new Uint8Array([0, 1, 2, 255]),
    },
    descriptor: {
      kind: "artifact.descriptor.image",
      width: 1,
      height: 1,
    },
    metadata: {
      featured: false,
      labels: ["preview", "示例"],
    },
    extensions: {
      "provider.artifact": { downloadable: false },
    },
  };
}
