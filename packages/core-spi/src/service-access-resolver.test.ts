// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type { ResolvedServiceAccess, ServiceAccess } from "@evolutos/mconet-core-domain";

import type { RuntimeComponent } from "./runtime-component.js";
import type { ServiceAccessResolver } from "./service-access-resolver.js";

it("defines the exact four-layer pure resolution boundary", () => {
  // RuntimeComponent supplies immutable descriptor metadata. Exact method typing
  // preserves layer roles instead of accepting an unlabelled variable list.
  expectTypeOf<ServiceAccessResolver>().toMatchTypeOf<RuntimeComponent>();
  expectTypeOf<ServiceAccessResolver["resolve"]>().toEqualTypeOf<
    (input: {
      readonly interactionOverride?: ServiceAccess;
      readonly requestAccess?: ServiceAccess;
      readonly clientDefault?: ServiceAccess;
      readonly integrationDefault?: ServiceAccess;
    }) => ResolvedServiceAccess
  >();
});

it("forwards labelled layers and preserves the resolved snapshot identity", () => {
  const interactionOverride: ServiceAccess = {
    authorization: { kind: "authorization.interaction" },
    headers: [],
    query: [],
    extensions: {},
  };
  const requestAccess: ServiceAccess = {
    endpoint: { kind: "absolute", value: "https://models.example.test/v1" },
    headers: [],
    query: [],
    extensions: {},
  };
  const resolved: ResolvedServiceAccess = {
    endpoint: { kind: "absolute", value: "https://models.example.test/v1" },
    authorization: { kind: "authorization.interaction" },
    headers: [],
    query: [],
    extensions: {},
  };
  const resolve = vi.fn((): ResolvedServiceAccess => {
    // Return the configured snapshot directly; default merging behavior belongs
    // to the later concrete resolver rather than this interface fixture.
    return resolved;
  });
  const resolver: ServiceAccessResolver = {
    descriptor: {
      name: "test-service-access-resolver",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    resolve,
  };
  const input = { interactionOverride, requestAccess } as const;

  // Identity assertions prove the SPI neither copies source layers nor wraps the
  // implementation-owned immutable result at the interface boundary.
  expect(resolver.resolve(input)).toBe(resolved);
  expect(resolve).toHaveBeenCalledOnce();
  expect(resolve).toHaveBeenCalledWith(input);
});

it("allows every layer to be omitted and preserves resolution failures", () => {
  const missingAccess = new Error("service access is incomplete");
  const resolver: ServiceAccessResolver = {
    descriptor: {
      name: "strict-service-access-resolver",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    resolve() {
      // No layer is itself a valid resolver input, but the implementation must
      // fail before execution when it cannot produce a complete access snapshot.
      throw missingAccess;
    },
  };

  // Empty input represents no contribution at any tier. The SPI preserves the
  // implementation failure for later runtime normalization instead of returning
  // a partially resolved ServiceAccess value.
  expect(() => resolver.resolve({})).toThrow(missingAccess);
});

it("does not expose credential request authorization or transport responsibilities", () => {
  // Those behaviors remain in CredentialSource, Adapter, AuthorizationHandler,
  // and Transport after this pure configuration resolution stage completes.
  expectTypeOf<ServiceAccessResolver>().not.toHaveProperty("getCredential");
  expectTypeOf<ServiceAccessResolver>().not.toHaveProperty("buildRequest");
  expectTypeOf<ServiceAccessResolver>().not.toHaveProperty("apply");
  expectTypeOf<ServiceAccessResolver>().not.toHaveProperty("send");
});
