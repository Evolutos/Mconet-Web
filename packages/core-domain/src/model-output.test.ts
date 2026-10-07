// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Diagnostic } from "./diagnostic.js";
import type { Extensions } from "./extensions.js";
import type { FinishReason } from "./finish-reason.js";
import type { ModelDescriptor } from "./model-descriptor.js";
import type { ModelOutput } from "./model-output.js";
import type { ModelTarget } from "./model-target.js";
import type { ModelTaskResult } from "./model-task-result.js";
import type { OutputStatus } from "./output-status.js";
import type { ProtocolState } from "./protocol-state.js";
import type { TokenUsage } from "./token-usage.js";

it("defines exactly the ten assembled output fields", () => {
  // Exact equality excludes request envelopes, service access, transport data,
  // task-specific projections, errors, callbacks, and assembly behavior.
  expectTypeOf<ModelOutput>().toEqualTypeOf<{
    readonly id?: string;
    readonly target: ModelTarget;
    readonly resolvedModel?: ModelDescriptor;
    readonly status: OutputStatus;
    readonly result: ModelTaskResult;
    readonly stopReason?: FinishReason;
    readonly usage?: TokenUsage;
    readonly diagnostics: readonly Diagnostic[];
    readonly protocolState: readonly ProtocolState[];
    readonly extensions: Extensions;
  }>();
});

it("accepts a complete structural output and preserves every owner", () => {
  const target = createModelTarget("requested-model");
  const resolvedModel: ModelDescriptor = {
    name: "actual-model",
    version: "2026-10",
    metadata: {},
    extensions: {},
  };
  const result = createModelTaskResult();
  const usage: TokenUsage = {
    inputTokens: 12,
    outputTokens: 8,
    totalTokens: 23,
    extensions: {},
  };
  const diagnostic = createDiagnostic();
  const state = createProtocolState();
  const diagnostics = [diagnostic] as const;
  const protocolState = [state] as const;
  const extensions = { "vendor.response_id": "response-9" } as const;
  const output: ModelOutput = {
    id: "output-7",
    target,
    resolvedModel,
    status: "completed",
    result,
    stopReason: "stop",
    usage,
    diagnostics,
    protocolState,
    extensions,
  };

  // Exact identities prove assembly does not merge request, protocol, Runtime,
  // task-result, accounting, state, or extension ownership.
  expect(acceptModelOutput(output)).toBe(output);
  expect(output.id).toBe("output-7");
  expect(output.target).toBe(target);
  expect(output.resolvedModel).toBe(resolvedModel);
  expect(output.result).toBe(result);
  expect(output.usage).toBe(usage);
  expect(output.diagnostics).toBe(diagnostics);
  expect(output.protocolState).toBe(protocolState);
  expect(output.extensions).toBe(extensions);
});

it("keeps the requested target and absent resolved model independent", () => {
  const target = createModelTarget("requested-model");
  const output: ModelOutput = {
    target,
    status: "unknown",
    result: createModelTaskResult(),
    diagnostics: [],
    protocolState: [],
    extensions: {},
  };

  // Requested identity remains available only through target. Missing service
  // facts stay absent instead of being copied from target or synthesized.
  expect(output.target).toBe(target);
  expect(output.target.model.name).toBe("requested-model");
  expect("id" in output).toBe(false);
  expect("resolvedModel" in output).toBe(false);
  expect("stopReason" in output).toBe(false);
  expect("usage" in output).toBe(false);
});

it("keeps Runtime diagnostics separate from ordered protocol state", () => {
  const diagnostic = createDiagnostic();
  const firstState = createProtocolState("state.cursor", "cursor-2");
  const secondState = createProtocolState("state.tool_call", {
    toolCallId: "call-7",
  });
  const output: ModelOutput = {
    target: createModelTarget(),
    status: "requires_action",
    result: createModelTaskResult(),
    diagnostics: [diagnostic],
    protocolState: [firstState, secondState],
    extensions: {},
  };

  // Runtime observations cannot become protocol state, and ordered provider
  // facts cannot be collapsed into diagnostic details or sorted by type.
  expect(output.diagnostics).toEqual([diagnostic]);
  expect(output.protocolState).toEqual([firstState, secondState]);
  expect(output.diagnostics[0]?.phase).toBe("response_parsing");
  expect(output.protocolState.map((state) => state.stateType)).toEqual([
    "state.cursor",
    "state.tool_call",
  ]);
});

it("preserves an integration-defined finish reason exactly", () => {
  const stopReason: FinishReason = "provider.safety_review_pending";
  const output: ModelOutput = {
    target: createModelTarget(),
    status: "incomplete",
    result: createModelTaskResult(),
    stopReason,
    diagnostics: [],
    protocolState: [],
    extensions: {},
  };

  // Assembly retains the parsed provider spelling without mapping it to status,
  // diagnostics, cancellation, a closed enum, or the generic unknown value.
  expect(output.stopReason).toBe(stopReason);
  expect(output.stopReason).toBe("provider.safety_review_pending");
});

it("requires Runtime and parsed ownership boundaries", () => {
  // A parsed-response-shaped value is incomplete until Runtime restores target,
  // supplies diagnostics, and provides the assembled extension boundary.
  expectTypeOf<{
    readonly result: ModelTaskResult;
    readonly status: OutputStatus;
    readonly protocolState: readonly ProtocolState[];
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ModelOutput>();
  expectTypeOf<{
    readonly target: ModelTarget;
    readonly result: ModelTaskResult;
    readonly status: OutputStatus;
    readonly diagnostics: readonly Diagnostic[];
    readonly protocolState: readonly ProtocolState[];
  }>().not.toMatchTypeOf<ModelOutput>();
});

it("prevents replacement of assembled values and collection membership", () => {
  const proveReadonly = (
    output: ModelOutput,
    target: ModelTarget,
    diagnostic: Diagnostic,
    state: ProtocolState,
  ): void => {
    // Compile invalid writes without executing this helper or mutating output.
    // @ts-expect-error Request target cannot be replaced after assembly.
    output.target = target;
    // @ts-expect-error Output status cannot be replaced after assembly.
    output.status = "failed";
    // @ts-expect-error Runtime diagnostic collection cannot be replaced.
    output.diagnostics = [diagnostic];
    // @ts-expect-error Readonly diagnostic membership cannot change.
    output.diagnostics.push(diagnostic);
    // @ts-expect-error Readonly protocol-state membership cannot change.
    output.protocolState.push(state);
    // @ts-expect-error Output extension entries remain readonly.
    output.extensions["vendor.changed"] = true;
  };

  // Retain the helper so strict TypeScript checks every readonly constraint.
  expectTypeOf(proveReadonly).toBeFunction();
});

/** Returns an output unchanged through its open structural boundary. */
function acceptModelOutput(output: ModelOutput): ModelOutput {
  // Identity return proves the interface adds no constructor, registration,
  // validation, copy, projection, or output-assembly side effect.
  return output;
}

/** Creates one request-owned target with an independently named model. */
function createModelTarget(modelName = "requested-model"): ModelTarget {
  // Distinct service, protocol, model, and deployment values keep routing facts
  // observable without inferring one identity from another.
  return {
    serviceId: "service.vendor",
    protocolId: "protocol.vendor",
    model: {
      name: modelName,
      metadata: {},
      extensions: {},
    },
    deploymentId: "deployment-primary",
    extensions: { routingHint: "east" },
  };
}

/** Creates the smallest complete task-neutral output result fixture. */
function createModelTaskResult(): ModelTaskResult {
  // Use a custom open task identity and explicit empty scopes so the output does
  // not acquire conversation-specific top-level fields or external lookup.
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
    metadata: { resultLabel: "comparison" },
    extensions: { "vendor.confidence": 0.97 },
  };
}

/** Creates one Runtime-owned technical observation. */
function createDiagnostic(): Diagnostic {
  // A response-parsing warning remains independently identifiable from output
  // status, finish reason, protocol state, and exceptions.
  return {
    code: "response_warning",
    severity: "warning",
    phase: "response_parsing",
    message: "Response included a provider warning.",
  };
}

/** Creates one service-owned opaque protocol-state fact. */
function createProtocolState(
  stateType = "state.cursor",
  stateValue: ProtocolState["stateValue"] = { cursor: "next-2" },
): ProtocolState {
  // Independent identities and an opaque value ensure the fixture cannot be
  // mistaken for a Runtime diagnostic or output convenience projection.
  return {
    serviceId: "service.vendor",
    protocolId: "protocol.vendor",
    stateType,
    stateValue,
  };
}
