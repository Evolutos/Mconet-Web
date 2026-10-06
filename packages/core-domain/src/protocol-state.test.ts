// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { JsonValue } from "./json-value.js";
import type { OpenIdentifier } from "./open-identifier.js";
import type { ProtocolState } from "./protocol-state.js";

it("defines exactly service protocol type and opaque state value", () => {
  // Exact equality excludes model identity, task result, output status, request
  // routing, continuation behavior, callbacks, and executable protocol logic.
  expectTypeOf<ProtocolState>().toEqualTypeOf<{
    readonly serviceId: OpenIdentifier;
    readonly protocolId: OpenIdentifier;
    readonly stateType: OpenIdentifier;
    readonly stateValue: JsonValue;
  }>();
});

it("keeps service protocol and state type identities independent", () => {
  const state: ProtocolState = {
    serviceId: "service.vendor",
    protocolId: "protocol.vendor.responses",
    stateType: "protocol.cursor",
    stateValue: "cursor-next",
  };

  // Distinct values prove no identity is inferred from either sibling or from
  // the opaque cursor spelling.
  expect(state.serviceId).toBe("service.vendor");
  expect(state.protocolId).toBe("protocol.vendor.responses");
  expect(state.stateType).toBe("protocol.cursor");
  expect(state.stateValue).toBe("cursor-next");
});

it("preserves recursive provider state without interpreting it", () => {
  const stateValue = {
    cursor: "next-page",
    sequence: 3,
    resumable: true,
    checkpoints: ["a", "b", null],
  } as const satisfies JsonValue;
  const state: ProtocolState = {
    serviceId: "service.vendor",
    protocolId: "protocol.vendor.responses",
    stateType: "provider.continuation",
    stateValue,
  };

  // Object identity and nested order remain exact; the domain value does not
  // parse a cursor, schedule continuation, or promote provider fields.
  expect(state.stateValue).toBe(stateValue);
  expect(state.stateValue).toEqual({
    cursor: "next-page",
    sequence: 3,
    resumable: true,
    checkpoints: ["a", "b", null],
  });
});

it("allows JSON null as an explicit state value", () => {
  const state: ProtocolState = {
    serviceId: "service.vendor",
    protocolId: "protocol.vendor",
    stateType: "provider.empty_state",
    stateValue: null,
  };

  // Null is a reported JSON fact distinct from omitting the entire ProtocolState
  // entry from the surrounding collection.
  expect(state.stateValue).toBeNull();
});

it("requires every identity and the state value", () => {
  // A partial tuple cannot erase ownership or confuse absent collection entries
  // with a present state whose JSON value is null.
  expectTypeOf<{
    readonly serviceId: OpenIdentifier;
    readonly protocolId: OpenIdentifier;
    readonly stateType: OpenIdentifier;
  }>().not.toMatchTypeOf<ProtocolState>();
  expectTypeOf<{
    readonly protocolId: OpenIdentifier;
    readonly stateType: OpenIdentifier;
    readonly stateValue: JsonValue;
  }>().not.toMatchTypeOf<ProtocolState>();
});

it("prevents identity and state replacement", () => {
  const proveReadonly = (state: ProtocolState): void => {
    // Compile invalid writes without executing this helper or mutating parsed
    // protocol facts at runtime.
    // @ts-expect-error Service identity cannot be replaced.
    state.serviceId = "service.changed";
    // @ts-expect-error Protocol identity cannot be replaced.
    state.protocolId = "protocol.changed";
    // @ts-expect-error State classification cannot be replaced.
    state.stateType = "state.changed";
    // @ts-expect-error Opaque state data cannot be replaced.
    state.stateValue = null;
  };

  // Retain the helper so strict TypeScript enforces every readonly boundary.
  expectTypeOf(proveReadonly).toBeFunction();
});

it("rejects non-JSON state storage", () => {
  // Functions, symbols, bigint values, and host objects are not portable state
  // representations across the SDK's language and wire boundaries.
  expectTypeOf<{
    readonly serviceId: OpenIdentifier;
    readonly protocolId: OpenIdentifier;
    readonly stateType: OpenIdentifier;
    readonly stateValue: () => void;
  }>().not.toMatchTypeOf<ProtocolState>();
  expectTypeOf<{
    readonly serviceId: OpenIdentifier;
    readonly protocolId: OpenIdentifier;
    readonly stateType: OpenIdentifier;
    readonly stateValue: bigint;
  }>().not.toMatchTypeOf<ProtocolState>();
});
