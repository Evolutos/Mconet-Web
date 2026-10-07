// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { ComponentTypeContract } from "./component-type-contract.js";
import type { ComponentDescriptor } from "./component-descriptor.js";

it("defines only immutable descriptive component metadata", () => {
  // Exact equality prevents component IDs, priorities, implementation values,
  // lifecycle hooks, registry keys, or selection results from entering metadata.
  expectTypeOf<ComponentDescriptor>().toEqualTypeOf<{
    readonly name: string;
    readonly version: string;
    readonly typeContract?: ComponentTypeContract;
    readonly capabilities: ReadonlySet<OpenIdentifier>;
    readonly source: "builtin" | "plugin" | "application";
  }>();
});

it("retains caller-owned contract and capability identities without normalization", () => {
  const typeContract: ComponentTypeContract = {
    inputTypeId: "vendor.request.payload",
    outputTypeId: "vendor.response.payload",
  };
  const capabilities: ReadonlySet<OpenIdentifier> = new Set([
    "codec.json",
    "vendor.extended_usage",
  ]);
  const descriptor: ComponentDescriptor = {
    name: "Example payload codec",
    version: "2026.10-preview",
    typeContract,
    capabilities,
    source: "plugin",
  };

  // A pure descriptor preserves the supplied references and values. Matching,
  // validation, copying, freezing, and priority resolution belong to later steps.
  expect(descriptor.typeContract).toBe(typeContract);
  expect(descriptor.capabilities).toBe(capabilities);
  expect([...descriptor.capabilities]).toEqual(["codec.json", "vendor.extended_usage"]);
  expect(descriptor).toMatchObject({
    name: "Example payload codec",
    version: "2026.10-preview",
    source: "plugin",
  });
});

it("allows descriptors that do not declare a type contract", () => {
  const descriptor: ComponentDescriptor = {
    name: "Default transport",
    version: "1.0.0",
    capabilities: new Set(),
    source: "builtin",
  };

  // Absence remains explicit and does not create an empty contract singleton or
  // infer port identities from name, version, capabilities, or source.
  expect(Object.hasOwn(descriptor, "typeContract")).toBe(false);
  expect(descriptor.capabilities.size).toBe(0);
});

it("restricts source to the three declared ownership tiers", () => {
  expectTypeOf<"builtin">().toMatchTypeOf<ComponentDescriptor["source"]>();
  expectTypeOf<"plugin">().toMatchTypeOf<ComponentDescriptor["source"]>();
  expectTypeOf<"application">().toMatchTypeOf<ComponentDescriptor["source"]>();
  expectTypeOf<"registry">().not.toMatchTypeOf<ComponentDescriptor["source"]>();
});

it("prevents metadata replacement and capability mutation through the contract", () => {
  const proveReadonly = (descriptor: ComponentDescriptor): void => {
    // The helper is never invoked; expected compile errors lock the immutable
    // public surface without attempting runtime mutation.
    // @ts-expect-error Component names are immutable descriptive metadata.
    descriptor.name = "replacement";
    // @ts-expect-error Component versions are immutable descriptive metadata.
    descriptor.version = "replacement";
    // @ts-expect-error Component port contracts cannot be replaced.
    descriptor.typeContract = {};
    // @ts-expect-error Component capability views cannot be replaced.
    descriptor.capabilities = new Set();
    // @ts-expect-error Component source ownership cannot be replaced.
    descriptor.source = "builtin";
    // @ts-expect-error ReadonlySet does not expose mutation through the descriptor.
    descriptor.capabilities.add("replacement.capability");
  };

  // Keeping the helper in the test program makes strict TypeScript verify every
  // forbidden operation without executing any assignment.
  expectTypeOf(proveReadonly).toBeFunction();
});
