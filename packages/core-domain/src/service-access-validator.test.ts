// Copyright © 2026 Mcont.

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { isServiceAccess, type ServiceAccess } from "./service-access.js";

describe("isServiceAccess", () => {
  // Reuse the smallest valid unresolved configuration so each negative case can
  // isolate one boundary rule without duplicating unrelated setup.
  const minimalAccess = {
    headers: [],
    query: [],
    extensions: {},
  } as const;

  it("accepts minimal and complete service access values", () => {
    const completeAccess = {
      endpoint: { kind: "absolute", value: "HTTPS://models.example.test/v1?region=global" },
      authorization: { kind: "example.signature", schemeData: "opaque" },
      headers: [
        { name: "x-feature", value: "alpha" },
        { name: "x-feature", value: "beta" },
      ],
      query: [
        { name: "tag", value: "café & tea" },
        { name: "tag", value: "" },
      ],
      apiVersion: "",
      projectId: "project-a",
      tenantId: "tenant-a",
      extensions: { "vendor.routing": { region: "global" } },
    };

    // Minimal input retains every unresolved default, while the complete value
    // proves case-insensitive schemes, repeated fields, and open auth data work.
    expect(isServiceAccess(minimalAccess)).toBe(true);
    expect(isServiceAccess(completeAccess)).toBe(true);
    expect(
      isServiceAccess({
        ...minimalAccess,
        endpoint: { kind: "absolute", value: "https://[2001:db8::1]:443/v1" },
      }),
    ).toBe(true);
  });

  it("narrows unknown input to ServiceAccess", () => {
    const candidate: unknown = minimalAccess;

    // Use the guard result before field access so TypeScript proves the public
    // predicate narrows an untrusted boundary value to the declared interface.
    expect(isServiceAccess(candidate)).toBe(true);
    if (!isServiceAccess(candidate)) {
      throw new Error("Expected the fixture to satisfy ServiceAccess.");
    }
    expect(candidate.headers).toHaveLength(0);
    expectTypeOf(isServiceAccess).toEqualTypeOf<(value: unknown) => value is ServiceAccess>();
  });

  it("rejects non-object and array roots", () => {
    const functionCandidate = (): null => {
      // Return value is irrelevant because validation must reject the callable
      // itself without executing it.
      return null;
    };
    const candidates: readonly unknown[] = [
      undefined,
      null,
      false,
      0,
      "access",
      [],
      functionCandidate,
    ];

    // Every non-record root violates the named ServiceAccess object boundary.
    for (const candidate of candidates) {
      expect(isServiceAccess(candidate)).toBe(false);
    }
  });

  it("requires own data properties for all three containers", () => {
    const inherited = Object.create({ headers: [], query: [], extensions: {} }) as object;
    const getter = vi.fn(() => {
      // Return a superficially valid collection if unsafe validation ever invokes
      // the accessor; the call assertion below must remain zero.
      return [];
    });
    const accessorHeaders = Object.defineProperties(
      { query: [], extensions: {} },
      {
        headers: {
          enumerable: true,
          get: getter,
        },
      },
    );

    // Missing, inherited, and accessor-backed containers fail without executing
    // the accessor used to model hostile boundary input.
    expect(isServiceAccess({ headers: [], query: [] })).toBe(false);
    expect(isServiceAccess({ headers: [], extensions: {} })).toBe(false);
    expect(isServiceAccess({ query: [], extensions: {} })).toBe(false);
    expect(isServiceAccess(inherited)).toBe(false);
    expect(isServiceAccess(accessorHeaders)).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it("accepts only absolute HTTP or HTTPS endpoints with network authority", () => {
    const endpoints = [
      { kind: "relative", value: "/v1/models" },
      { kind: "absolute", value: "ftp://models.example.test/v1" },
      { kind: "absolute", value: "https:" },
      { kind: "absolute", value: "not a URI" },
      { kind: "absolute", value: "https://:443/v1" },
      { kind: "absolute", value: "https://[2001:db8::1]:not-a-port/v1" },
      { kind: "absolute", value: "https://[2001:db8::1]unexpected/v1" },
      { kind: "absolute", value: "https://user:secret@models.example.test/v1" },
      { kind: "absolute", value: "https://models.example.test/v1#fragment" },
    ] as const;

    // Each endpoint violates URI syntax, transport scheme, authority, secret, or
    // fragment policy while the surrounding access structure remains valid.
    for (const endpoint of endpoints) {
      expect(isServiceAccess({ ...minimalAccess, endpoint })).toBe(false);
    }
  });

  it("rejects present undefined and accessor-backed optional fields", () => {
    const getter = vi.fn(() => {
      // Return a valid-looking string solely to prove descriptor validation does
      // not obtain optional configuration by running accessors.
      return "hidden";
    });
    const accessorVersion = Object.defineProperty({ ...minimalAccess }, "apiVersion", {
      enumerable: true,
      get: getter,
    });

    // Exact optional semantics accept true absence, not explicit undefined or an
    // accessor whose returned value merely appears to have the correct type.
    expect(isServiceAccess({ ...minimalAccess, endpoint: undefined })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, authorization: undefined })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, apiVersion: 1 })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, projectId: false })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, tenantId: null })).toBe(false);
    expect(isServiceAccess(accessorVersion)).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects accessor-backed endpoints without executing them", () => {
    const endpointGetter = vi.fn(() => {
      // Return a valid-looking endpoint if invoked so the assertion isolates the
      // required own-data-property boundary.
      return { kind: "absolute", value: "https://models.example.test/v1" };
    });
    const candidate = Object.defineProperty({ ...minimalAccess }, "endpoint", {
      enumerable: true,
      get: endpointGetter,
    });

    // Optional endpoint presence cannot be implemented by an accessor because
    // boundary validation must remain side-effect free.
    expect(isServiceAccess(candidate)).toBe(false);
    expect(endpointGetter).not.toHaveBeenCalled();
  });

  it("validates only the authorization kind discriminator", () => {
    const secretGetter = vi.fn(() => {
      // Model scheme-owned sensitive state that the base validator must leave
      // opaque while inspecting only the authorization kind.
      return "do-not-read";
    });
    const openAuthorization = Object.defineProperty({ kind: "company.signature" }, "credential", {
      enumerable: true,
      get: secretGetter,
    });
    const kindGetter = vi.fn(() => {
      // Return a valid identifier to ensure an accessor is rejected by shape,
      // rather than accepted because of the value it could compute.
      return "company.signature";
    });
    const accessorKind = Object.defineProperty({}, "kind", {
      enumerable: true,
      get: kindGetter,
    });

    // Scheme-owned data remains opaque and unread, while the stable kind must be
    // an own valid identifier stored directly on a non-array object.
    expect(isServiceAccess({ ...minimalAccess, authorization: openAuthorization })).toBe(true);
    expect(isServiceAccess({ ...minimalAccess, authorization: {} })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, authorization: { kind: "bad kind" } })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, authorization: "company.signature" })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, authorization: ["company.signature"] })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, authorization: accessorKind })).toBe(false);
    expect(secretGetter).not.toHaveBeenCalled();
    expect(kindGetter).not.toHaveBeenCalled();
  });

  it("accepts normalized repeated headers and rejects unsafe header fields", () => {
    const invalidHeaders: readonly unknown[] = [
      [{ name: "", value: "value" }],
      [{ name: "X-Feature", value: "value" }],
      [{ name: "x feature", value: "value" }],
      [{ name: "x-feature", value: "first\rsecond" }],
      [{ name: "x-feature", value: "first\nsecond" }],
      [{ name: 1, value: "value" }],
      [{ name: "x-feature", value: 1 }],
      [{ name: "x-feature" }],
    ];

    // Each candidate targets one name, injection, type, or required-field rule;
    // all must fail without weakening repeated-name support for valid headers.
    expect(
      isServiceAccess({
        ...minimalAccess,
        headers: [
          { name: "x-feature", value: "alpha" },
          { name: "x-feature", value: "beta" },
        ],
      }),
    ).toBe(true);
    for (const headers of invalidHeaders) {
      expect(isServiceAccess({ ...minimalAccess, headers })).toBe(false);
    }
  });

  it("does not execute header or query occurrence accessors", () => {
    const headerGetter = vi.fn(() => {
      // Return a valid normalized name if invoked so the zero-call assertion
      // specifically proves descriptor-only header validation.
      return "x-feature";
    });
    const queryGetter = vi.fn(() => {
      // Return a valid raw query name if invoked so accessor rejection cannot be
      // confused with value-level query validation.
      return "tag";
    });
    const accessorHeader = Object.defineProperty({ value: "value" }, "name", {
      enumerable: true,
      get: headerGetter,
    });
    const accessorQuery = Object.defineProperty({ value: "value" }, "name", {
      enumerable: true,
      get: queryGetter,
    });

    // Descriptor inspection rejects accessors at both occurrence boundaries and
    // proves neither getter runs as a side effect of validation.
    expect(isServiceAccess({ ...minimalAccess, headers: [accessorHeader] })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, query: [accessorQuery] })).toBe(false);
    expect(headerGetter).not.toHaveBeenCalled();
    expect(queryGetter).not.toHaveBeenCalled();
  });

  it("accepts pre-encoding query text and rejects incomplete query occurrences", () => {
    // Query names and values remain case-sensitive raw strings; percent-encoding
    // and empty-string policy belong to the target transport or service.
    expect(
      isServiceAccess({
        ...minimalAccess,
        query: [
          { name: "Filter[Name]", value: "café & tea" },
          { name: "", value: "" },
        ],
      }),
    ).toBe(true);
    expect(isServiceAccess({ ...minimalAccess, query: [{ name: "tag" }] })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, query: [{ name: 1, value: "x" }] })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, query: [{ name: "tag", value: 1 }] })).toBe(false);
  });

  it("rejects sparse and accessor-backed occurrence arrays", () => {
    const sparseHeaders = new Array<unknown>(1);
    const queryGetter = vi.fn(() => {
      // Return a complete occurrence if invoked; dense-array validation must
      // reject the indexed accessor before evaluating this body.
      return { name: "tag", value: "value" };
    });
    const accessorQuery = Object.defineProperty([], "0", {
      configurable: true,
      enumerable: true,
      get: queryGetter,
    });
    Object.defineProperty(accessorQuery, "length", { value: 1 });

    // Dense own data elements are required so missing positions and indexed
    // accessors cannot acquire meaning through ordinary array reads.
    expect(isServiceAccess({ ...minimalAccess, headers: sparseHeaders })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, query: accessorQuery })).toBe(false);
    expect(queryGetter).not.toHaveBeenCalled();
  });

  it("rejects non-array collections and invalid occurrence object roots", () => {
    const revokedOccurrence = Proxy.revocable({}, {});
    revokedOccurrence.revoke();

    // Collection aliases require actual dense arrays, and each element must be a
    // safe named object rather than a primitive, nested array, or revoked Proxy.
    expect(isServiceAccess({ ...minimalAccess, headers: {} })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, query: {} })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, headers: [null] })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, query: [[]] })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, headers: [revokedOccurrence.proxy] })).toBe(false);
  });

  it("delegates extension validation to the JSON record boundary", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const extensionGetter = vi.fn(() => {
      // Return JSON-compatible text if invoked so the test isolates the rule that
      // extension records cannot contain accessors.
      return "hidden";
    });
    const accessorExtensions = Object.defineProperty({}, "unsafe", {
      enumerable: true,
      get: extensionGetter,
    });

    // Arrays, cycles, and accessors are not JSON object maps; the delegated
    // validator rejects them without evaluating extension code.
    expect(isServiceAccess({ ...minimalAccess, extensions: [] })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, extensions: cyclic })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, extensions: accessorExtensions })).toBe(false);
    expect(extensionGetter).not.toHaveBeenCalled();
  });

  it("ignores unknown top-level accessors without executing them", () => {
    const unknownGetter = vi.fn(() => {
      // Model application-owned structural data that remains outside validator
      // control and therefore must never be evaluated.
      return "application-owned";
    });
    const candidate = Object.defineProperty({ ...minimalAccess }, "customAccessData", {
      enumerable: true,
      get: unknownGetter,
    });

    // Structural extension remains open, but unknown data cannot participate in
    // validation or control flow and therefore never needs to be read.
    expect(isServiceAccess(candidate)).toBe(true);
    expect(unknownGetter).not.toHaveBeenCalled();
  });

  it("contains root and nested Proxy failures", () => {
    const rootProxy = new Proxy(
      {},
      {
        ownKeys() {
          // Model a hostile reflection boundary that throws during descriptor capture.
          throw new Error("root descriptor failure");
        },
      },
    );
    const headerProxy = new Proxy([], {
      getOwnPropertyDescriptor() {
        // Model a hostile collection that fails indexed descriptor inspection.
        throw new Error("header descriptor failure");
      },
    });
    const authorizationProxy = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          // Model a hostile authorization object that rejects kind inspection.
          throw new Error("authorization descriptor failure");
        },
      },
    );
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();

    // Every reflective failure becomes false rather than escaping the validator.
    expect(isServiceAccess(rootProxy)).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, headers: headerProxy })).toBe(false);
    expect(isServiceAccess({ ...minimalAccess, authorization: authorizationProxy })).toBe(false);
    expect(isServiceAccess(revoked.proxy)).toBe(false);
  });
});
