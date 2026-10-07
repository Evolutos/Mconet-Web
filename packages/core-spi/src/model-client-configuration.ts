// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  InteractionResourceLimits,
  ModelTarget,
  ServiceAccess,
} from "@evolutos/mconet-core-domain";

import type { MonitoringOptions } from "./monitoring-options.js";
import type { RuntimeComponents } from "./runtime-components.js";

/**
 * Immutable reusable configuration accepted when constructing a model client.
 *
 * Domain defaults, direct component injections, and monitoring defaults remain
 * separate optional inputs because later resolvers apply different precedence,
 * validation, ownership, and merge rules to each group. This structural contract
 * performs no defaulting or resolution and contains no interaction-scoped signal,
 * deadline, raw-response choice, request data, credential, or execution state.
 */
export interface ModelClientConfiguration {
  /** Optional model target used when an individual request does not provide one. */
  readonly defaultTarget?: ModelTarget;

  /** Optional service access input below request and interaction overrides. */
  readonly defaultServiceAccess?: ServiceAccess;

  /** Optional compatibility strategy below a single-interaction override. */
  readonly defaultCompatibilityPolicy?: CompatibilityPolicy;

  /** Optional per-field resource limits below single-interaction limits. */
  readonly defaultResourceLimits?: InteractionResourceLimits;

  /** Optional direct component choices retained for deterministic Client-level resolution. */
  readonly components?: RuntimeComponents;

  /** Optional reusable monitoring inputs merged with each interaction's options. */
  readonly monitoringDefaults?: MonitoringOptions;
}
