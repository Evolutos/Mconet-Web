// Copyright © 2026 Mcont.

import type { ModelRequest, ProcessingResult } from "@evolutos/mconet-core-domain";
import type {
  ProtocolExecutionPlan,
  ProtocolRequestPlan,
  TaskProtocolAdapter,
} from "@evolutos/mconet-core-spi";

/**
 * Schedules protocol request planning for one validated execution plan.
 *
 * The adapter's `buildRequest` is called exactly once. The result is a request
 * plan, not encoded bytes and not an authorized call. A missing value is
 * returned unchanged and is not retried.
 *
 * @param input Adapter, request, and the execution plan that governs mapping.
 * @returns The adapter's request-plan result.
 */
export function scheduleBuildRequest(input: {
  readonly adapter: TaskProtocolAdapter;
  readonly request: ModelRequest;
  readonly plan: ProtocolExecutionPlan;
}): ProcessingResult<ProtocolRequestPlan> {
  // One call keeps planning deterministic. Encoding and authorization are later
  // stages and are not reachable from this function.
  return input.adapter.buildRequest({
    request: input.request,
    plan: input.plan,
  });
}
