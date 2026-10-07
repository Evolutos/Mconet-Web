// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  InteractionMode,
  ModelInteractionError,
  ModelRequest,
  ModelTarget,
  ParsedTaskResponse,
  ProcessingResult,
  TaskDescriptor,
} from "@evolutos/mconet-core-domain";

import type { ErasedRuntimeValue } from "./erased-runtime-value.js";
import type { ProtocolExecutionPlan } from "./protocol-execution-plan.js";
import type { ProtocolRequestPlan } from "./protocol-request-plan.js";
import type { RuntimeComponent } from "./runtime-component.js";
import type { TransportResponseMetadata } from "./transport-response-metadata.js";

/**
 * Replaceable protocol behavior for one model-task interaction family.
 *
 * The adapter synchronously matches a target, prepares deterministic execution
 * requirements, maps one validated model request into an unencoded protocol
 * payload, and parses decoded success or service-error values. It does not
 * resolve credentials, select component instances, encode bytes, authorize a
 * transport request, perform network I/O, or assemble the public ModelOutput.
 */
export interface TaskProtocolAdapter extends RuntimeComponent {
  /** Determines whether this adapter handles the supplied target, task, and mode. */
  supports(input: {
    readonly target: ModelTarget;
    readonly task: TaskDescriptor;
    readonly mode: InteractionMode;
  }): boolean;

  /** Produces deterministic execution requirements without I/O or credential access. */
  preparePlan(input: {
    readonly request: ModelRequest;
    readonly mode: InteractionMode;
    readonly policy: CompatibilityPolicy;
  }): ProcessingResult<ProtocolExecutionPlan>;

  /** Maps a validated request into a protocol payload without encoding or authorization. */
  buildRequest(input: {
    readonly request: ModelRequest;
    readonly plan: ProtocolExecutionPlan;
  }): ProcessingResult<ProtocolRequestPlan>;

  /** Parses one decoded successful payload while preserving transport evidence separately. */
  parseResponse(input: {
    readonly payload: ErasedRuntimeValue;
    readonly metadata: TransportResponseMetadata;
  }): ProcessingResult<ParsedTaskResponse>;

  /** Classifies one decoded service-error payload as the standard interaction error. */
  parseError(input: {
    readonly payload: ErasedRuntimeValue;
    readonly metadata: TransportResponseMetadata;
  }): ModelInteractionError;
}
