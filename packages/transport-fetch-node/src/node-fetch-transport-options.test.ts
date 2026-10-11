// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type {
  NodeFetch,
  NodeFetchDispatcher,
  NodeFetchDispatcherOwnership,
  NodeFetchTransportOptions,
} from "./node-fetch-transport-options.js";

it("keeps fetch, the dispatcher, and its owner as separate fields", () => {
  expectTypeOf<NodeFetchTransportOptions["fetch"]>().toEqualTypeOf<NodeFetch | undefined>();
  expectTypeOf<NodeFetchTransportOptions["dispatcher"]>().toEqualTypeOf<
    NodeFetchDispatcher | undefined
  >();
  expectTypeOf<NodeFetchTransportOptions["dispatcherOwnership"]>().toEqualTypeOf<
    NodeFetchDispatcherOwnership | undefined
  >();
  expectTypeOf<keyof NodeFetchTransportOptions>().toEqualTypeOf<
    "dispatcher" | "dispatcherOwnership" | "fetch"
  >();
  expectTypeOf<NodeFetchDispatcherOwnership>().not.toMatchTypeOf<NodeFetchDispatcher>();
  expectTypeOf<"shared">().not.toMatchTypeOf<NodeFetchDispatcherOwnership>();

  let fetchCalls = 0;
  let closeCalls = 0;
  const fetchImplementation: NodeFetch = () => {
    fetchCalls += 1;
    return Promise.reject(new Error("fetch called"));
  };
  const dispatcher: NodeFetchDispatcher = {
    close() {
      closeCalls += 1;
    },
  };
  const fetchOnly: NodeFetchTransportOptions = { fetch: fetchImplementation };
  const dispatcherOnly: NodeFetchTransportOptions = { dispatcher };
  const ownershipOnly: NodeFetchTransportOptions = { dispatcherOwnership: "application" };

  expect(fetchOnly.dispatcher).toBeUndefined();
  expect(fetchOnly.dispatcherOwnership).toBeUndefined();
  expect(dispatcherOnly.fetch).toBeUndefined();
  expect(dispatcherOnly.dispatcherOwnership).toBeUndefined();
  expect(ownershipOnly.fetch).toBeUndefined();
  expect(ownershipOnly.dispatcher).toBeUndefined();
  expect(fetchCalls).toBe(0);
  expect(closeCalls).toBe(0);
});
