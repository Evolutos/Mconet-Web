// Copyright © 2026 Mcont.

import type { Diagnostic } from "./diagnostic.js";
import type { Extensions } from "./extensions.js";
import type { FinishReason } from "./finish-reason.js";
import type { ModelDescriptor } from "./model-descriptor.js";
import type { ModelTarget } from "./model-target.js";
import type { ModelTaskResult } from "./model-task-result.js";
import type { OutputStatus } from "./output-status.js";
import type { ProtocolState } from "./protocol-state.js";
import type { TokenUsage } from "./token-usage.js";

/**
 * Immutable task-neutral output assembled for one model interaction.
 *
 * The original request target, service-parsed facts, Runtime diagnostics, and
 * output extensions remain separate owned values. Protocol adapters return a
 * ParsedTaskResponse rather than constructing this boundary; Runtime assembly,
 * validation, transport observations, and task-specific projections remain
 * outside the data contract.
 */
export interface ModelOutput {
  /** Optional output identity assigned without using a provider response ID. */
  readonly id?: string;

  /** Exact model target retained from the originating request. */
  readonly target: ModelTarget;

  /** Actual model identity only when explicitly reported by the service. */
  readonly resolvedModel?: ModelDescriptor;

  /** Required protocol-derived output status. */
  readonly status: OutputStatus;

  /** Task-neutral service result with its result-local Artifact scope. */
  readonly result: ModelTaskResult;

  /** Exact open reason only when explicitly reported by the protocol. */
  readonly stopReason?: FinishReason;

  /** Token accounting only when explicitly reported by the service. */
  readonly usage?: TokenUsage;

  /** Ordered immutable technical observations collected by Runtime. */
  readonly diagnostics: readonly Diagnostic[];

  /** Ordered protocol continuation and service-state facts. */
  readonly protocolState: readonly ProtocolState[];

  /** Always-present unknown assembled-output fields retained without promotion. */
  readonly extensions: Extensions;
}
