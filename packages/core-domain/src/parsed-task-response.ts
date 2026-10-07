// Copyright © 2026 Mcont.

import type { Extensions } from "./extensions.js";
import type { FinishReason } from "./finish-reason.js";
import type { ModelDescriptor } from "./model-descriptor.js";
import type { ModelTaskResult } from "./model-task-result.js";
import type { OutputStatus } from "./output-status.js";
import type { ProtocolState } from "./protocol-state.js";
import type { TokenUsage } from "./token-usage.js";

/**
 * Immutable protocol facts parsed from one model-service response.
 *
 * Optional values remain absent when the service did not report them; adapters
 * must not synthesize them from request or integration configuration. Request
 * target, Runtime diagnostics, interaction identity, transport observations,
 * and output assembly remain outside this parsed-response boundary.
 */
export interface ParsedTaskResponse {
  /** Task-neutral result parsed from the response payload. */
  readonly result: ModelTaskResult;

  /** Actual model identity only when explicitly reported by the service. */
  readonly resolvedModel?: ModelDescriptor;

  /** Required service-reported or protocol-derived output status. */
  readonly status: OutputStatus;

  /** Exact open reason only when explicitly reported by the protocol. */
  readonly stopReason?: FinishReason;

  /** Token accounting only when explicitly reported by the service. */
  readonly usage?: TokenUsage;

  /** Ordered protocol continuation and service-state facts. */
  readonly protocolState: readonly ProtocolState[];

  /** Always-present unknown protocol fields retained without promotion. */
  readonly extensions: Extensions;
}
