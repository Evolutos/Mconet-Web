// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

import type { TransportSelection } from "./transport-selection.js";

it("defines only immutable transport selection criteria", () => {
  // Exact equality prevents component IDs, instances, priorities, endpoints,
  // requests, or transport execution from entering protocol selection facts.
  expectTypeOf<TransportSelection>().toEqualTypeOf<{
    readonly transportKind?: OpenIdentifier;
    readonly requiredCapabilities: ReadonlySet<OpenIdentifier>;
  }>();
});

it("preserves the open transport kind and required capability set", () => {
  const requiredCapabilities: ReadonlySet<OpenIdentifier> = new Set([
    "transport.http",
    "transport.response.bounded",
  ]);
  const selection: TransportSelection = {
    transportKind: "transport.fetch",
    requiredCapabilities,
  };

  // The planning value retains the declared identity and set reference without
  // ordering, deduplicating, expanding, or matching candidate components.
  expect(selection.transportKind).toBe("transport.fetch");
  expect(selection.requiredCapabilities).toBe(requiredCapabilities);
  expect([...selection.requiredCapabilities]).toEqual([
    "transport.http",
    "transport.response.bounded",
  ]);
});

it("supports an omitted kind with an explicit empty capability set", () => {
  const requiredCapabilities: ReadonlySet<OpenIdentifier> = new Set();
  const selection: TransportSelection = { requiredCapabilities };

  // Kind absence does not invent HTTP or fetch. The required empty set remains
  // explicit so every selection has one stable capability collection boundary.
  expect(Object.hasOwn(selection, "transportKind")).toBe(false);
  expect(selection.transportKind).toBeUndefined();
  expect(selection.requiredCapabilities).toBe(requiredCapabilities);
  expect(selection.requiredCapabilities.size).toBe(0);
});

it("accepts integration-defined transport kinds and capabilities", () => {
  const transportKind = "vendor.transport.gateway" as OpenIdentifier;
  const capability = "vendor.transport.signed-routing" as OpenIdentifier;
  const selection: TransportSelection = {
    transportKind,
    requiredCapabilities: new Set([capability]),
  };

  // Open identifiers remain exact instead of being coerced into a closed list of
  // built-in transport families or capabilities.
  expect(selection.transportKind).toBe(transportKind);
  expect(selection.requiredCapabilities.has(capability)).toBe(true);
});

it("prevents mutation of selection fields and capability membership", () => {
  const proveReadonly = (
    selection: TransportSelection,
    capabilities: ReadonlySet<OpenIdentifier>,
  ): void => {
    // This compile-only helper locks both property references and the exposed set
    // surface without mutating a protocol plan fixture at runtime.
    // @ts-expect-error The planned transport kind cannot be replaced.
    selection.transportKind = "replacement.transport";
    // @ts-expect-error The required capability set cannot be replaced.
    selection.requiredCapabilities = capabilities;
    // @ts-expect-error ReadonlySet exposes no capability mutation method.
    selection.requiredCapabilities.add("replacement.capability");
  };

  expectTypeOf(proveReadonly).toBeFunction();
});

it("does not identify configure or execute a transport component", () => {
  // Component resolution, access data, and network I/O remain separate stages.
  expectTypeOf<TransportSelection>().not.toHaveProperty("componentId");
  expectTypeOf<TransportSelection>().not.toHaveProperty("transport");
  expectTypeOf<TransportSelection>().not.toHaveProperty("endpoint");
  expectTypeOf<TransportSelection>().not.toHaveProperty("request");
  expectTypeOf<TransportSelection>().not.toHaveProperty("send");
  expectTypeOf<TransportSelection>().not.toHaveProperty("priority");
});
