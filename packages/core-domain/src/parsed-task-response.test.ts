// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { FinishReason } from "./finish-reason.js";
import type { ModelDescriptor } from "./model-descriptor.js";
import type { ModelTaskResult } from "./model-task-result.js";
import type { OutputStatus } from "./output-status.js";
import type { ParsedTaskResponse } from "./parsed-task-response.js";
import type { ProtocolState } from "./protocol-state.js";
import type { TokenUsage } from "./token-usage.js";

it("defines exactly the seven protocol-parsed facts", () => {
  // Exact equality excludes request target, diagnostics, interaction identity,
  // transport observations, response metadata wrappers, and assembly behavior.
  expectTypeOf<ParsedTaskResponse>().toEqualTypeOf<{
    readonly result: ModelTaskResult;
    readonly resolvedModel?: ModelDescriptor;
    readonly status: OutputStatus;
    readonly stopReason?: FinishReason;
    readonly usage?: TokenUsage;
    readonly protocolState: readonly ProtocolState[];
    readonly extensions: Extensions;
  }>();
});

it("preserves every reported protocol fact and state order", () => {
  const result = createModelTaskResult();
  const resolvedModel: ModelDescriptor = {
    name: "model-actual",
    version: "2026-10",
    metadata: {},
    extensions: {},
  };
  const usage: TokenUsage = {
    inputTokens: 13,
    outputTokens: 8,
    totalTokens: 21,
    extensions: {},
  };
  const firstState = createProtocolState("response.cursor", "cursor-2");
  const secondState = createProtocolState("response.tool_call", {
    toolCallId: "call-7",
  });
  const protocolState = [firstState, secondState] as const;
  const extensions = { "vendor.response_id": "response-9" } as const;
  const response: ParsedTaskResponse = {
    result,
    resolvedModel,
    status: "requires_action",
    stopReason: "tool_calls",
    usage,
    protocolState,
    extensions,
  };

  // Exact identities and order prove this envelope carries decoded facts
  // without converting task data, model identity, accounting, or state.
  expect(response.result).toBe(result);
  expect(response.resolvedModel).toBe(resolvedModel);
  expect(response.status).toBe("requires_action");
  expect(response.stopReason).toBe("tool_calls");
  expect(response.usage).toBe(usage);
  expect(response.protocolState).toBe(protocolState);
  expect(response.protocolState).toEqual([firstState, secondState]);
  expect(response.extensions).toBe(extensions);
});

it("preserves absent optional service facts without synthesis", () => {
  const result = createModelTaskResult();
  const response: ParsedTaskResponse = {
    result,
    status: "completed",
    protocolState: [],
    extensions: {},
  };

  // Property absence is authoritative: no request target or result descriptor
  // becomes resolvedModel, and no status-derived reason or usage is invented.
  expect(response.result).toBe(result);
  expect("resolvedModel" in response).toBe(false);
  expect("stopReason" in response).toBe(false);
  expect("usage" in response).toBe(false);
  expect(response.protocolState).toEqual([]);
});

it("preserves an integration-defined finish reason exactly", () => {
  const stopReason: FinishReason = "provider.safety_review_pending";
  const response: ParsedTaskResponse = {
    result: createModelTaskResult(),
    status: "incomplete",
    stopReason,
    protocolState: [],
    extensions: {},
  };

  // The parsed value remains the provider spelling and is not collapsed to an
  // OutputStatus, the generic `unknown` value, or an SDK-owned closed enum.
  expect(response.stopReason).toBe(stopReason);
  expect(response.stopReason).toBe("provider.safety_review_pending");
});

it("requires result status state collection and extension storage", () => {
  // Optional protocol facts may be absent, but required ownership boundaries
  // cannot be defaulted by the interface or recovered from an outer request.
  expectTypeOf<{
    readonly result: ModelTaskResult;
    readonly status: OutputStatus;
  }>().not.toMatchTypeOf<ParsedTaskResponse>();
  expectTypeOf<{
    readonly result: ModelTaskResult;
    readonly status: OutputStatus;
    readonly protocolState: readonly ProtocolState[];
  }>().not.toMatchTypeOf<ParsedTaskResponse>();
});

it("rejects runtime-owned and explicitly undefined optional representations", () => {
  // Runtime fields cannot substitute for required parsed facts, and exact
  // optional properties distinguish true absence from a present undefined value.
  expectTypeOf<{
    readonly result: ModelTaskResult;
    readonly target: unknown;
    readonly diagnostics: readonly unknown[];
    readonly status: OutputStatus;
    readonly protocolState: readonly ProtocolState[];
    readonly extensions: Extensions;
  }>().not.toEqualTypeOf<ParsedTaskResponse>();
  expectTypeOf<{
    readonly result: ModelTaskResult;
    readonly resolvedModel: undefined;
    readonly status: OutputStatus;
    readonly protocolState: readonly ProtocolState[];
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ParsedTaskResponse>();
});

it("prevents replacement of parsed protocol facts", () => {
  const proveReadonly = (
    response: ParsedTaskResponse,
    result: ModelTaskResult,
    state: ProtocolState,
  ): void => {
    // Compile invalid writes without executing this helper or mutating facts.
    // @ts-expect-error Parsed task result cannot be replaced.
    response.result = result;
    // @ts-expect-error Parsed status cannot be replaced.
    response.status = "failed";
    // @ts-expect-error Protocol-state collection cannot be replaced.
    response.protocolState = [state];
    // @ts-expect-error Readonly protocol-state membership cannot change.
    response.protocolState.push(state);
    // @ts-expect-error Parsed extension entries remain readonly.
    response.extensions["vendor.changed"] = true;
  };

  // Retain the helper so strict TypeScript checks every readonly constraint.
  expectTypeOf(proveReadonly).toBeFunction();
});

/** Creates the smallest complete task-neutral parsed result fixture. */
function createModelTaskResult(): ModelTaskResult {
  // Use a custom open task identity and explicit empty ownership scopes so the
  // response type does not depend on a concrete conversation result.
  return {
    descriptor: {
      type: "vendor.document_compare",
      metadata: {},
      extensions: {},
    },
    document: {
      version: "1.0",
      root: {
        id: "result-root",
        kind: "task.result_root",
        composition: "container",
        children: [],
        relations: [],
        metadata: {},
        extensions: {},
      },
      metadata: {},
      extensions: {},
    },
    artifacts: { artifacts: [] },
    metadata: {},
    extensions: {},
  };
}

/** Creates one independently owned protocol-state fact for ordering tests. */
function createProtocolState(
  stateType: string,
  stateValue: ProtocolState["stateValue"],
): ProtocolState {
  // Keep service, protocol, classification, and opaque value separate so state
  // ordering tests cannot pass through a compound shortcut representation.
  return {
    serviceId: "vendor.service",
    protocolId: "vendor.protocol",
    stateType,
    stateValue,
  };
}
