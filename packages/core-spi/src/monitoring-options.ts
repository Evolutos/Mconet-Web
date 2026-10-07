// Copyright © 2026 Mcont.

import type { InteractionMonitor } from "./interaction-monitor.js";

/**
 * Immutable per-client or per-interaction monitoring configuration.
 *
 * Omitted fields represent an empty monitor list, append merging, and disabled
 * request and response body capture. Enabling either capture flag also requires
 * a positive maximum byte count; the later configuration resolver validates that
 * cross-field rule before any event snapshot or body copy can be created.
 */
export interface MonitoringOptions {
  /** Optional ordered monitors participating in observation. */
  readonly monitors?: readonly InteractionMonitor[];

  /** How interaction monitors combine with configured client defaults. */
  readonly mergeMode?: "append" | "prepend" | "replace";

  /** Whether bounded, sanitized request body capture is explicitly enabled. */
  readonly captureRequestBody?: boolean;

  /** Whether bounded, sanitized response body capture is explicitly enabled. */
  readonly captureResponseBody?: boolean;

  /** Positive shared byte limit required whenever either body capture flag is true. */
  readonly maxCapturedBodyBytes?: number;
}
