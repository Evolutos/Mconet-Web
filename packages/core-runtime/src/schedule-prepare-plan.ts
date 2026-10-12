// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  InteractionMode,
  ModelRequest,
  ProcessingResult,
} from "@evolutos/mconet-core-domain";
import type { ProtocolExecutionPlan, TaskProtocolAdapter } from "@evolutos/mconet-core-spi";

/**
 * Schedules one protocol execution plan.
 *
 * The adapter's `preparePlan` is called exactly once with the request, mode,
 * and compatibility policy. A missing value is returned as that same result
 * and is not retried. This stage does not encode, authorize, or call a
 * transport.
 *
 * @param input Adapter and the planning inputs it receives once.
 * @returns The adapter's planning result, including a failure without a value.
 */
export function schedulePreparePlan(input: {
  readonly adapter: TaskProtocolAdapter;
  readonly request: ModelRequest;
  readonly mode: InteractionMode;
  readonly policy: CompatibilityPolicy;
}): ProcessingResult<ProtocolExecutionPlan> {
  // One call is the contract. A failed result stays failed; a later stage stops.
  return input.adapter.preparePlan({
    request: input.request,
    mode: input.mode,
    policy: input.policy,
  });
}
