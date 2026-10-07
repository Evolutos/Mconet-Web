// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  InteractionResourceLimits,
  ServiceAccess,
} from "@evolutos/mconet-core-domain";

import type { MonitoringOptions } from "./monitoring-options.js";
import type { RuntimeComponents } from "./runtime-components.js";

/**
 * Immutable overrides and lifecycle inputs applied to one model interaction.
 *
 * Every field is optional and remains scoped to the current call. Later Runtime
 * stages independently merge component, access, compatibility, resource-limit,
 * and monitoring inputs; compose cancellation and deadline signals; and enforce
 * bounded raw-response capture. This data contract performs none of that work and
 * must never be written back into reusable Client configuration.
 */
export interface InteractionOptions {
  /** Optional direct components with precedence above reusable Client choices. */
  readonly components?: RuntimeComponents;

  /** Optional whole service-access override for only this interaction. */
  readonly serviceAccessOverride?: ServiceAccess;

  /** Optional compatibility strategy for only this interaction. */
  readonly compatibilityPolicy?: CompatibilityPolicy;

  /** Optional per-field resource-limit overrides for only this interaction. */
  readonly resourceLimits?: InteractionResourceLimits;

  /** Optional monitoring inputs merged with reusable Client monitoring defaults. */
  readonly monitoringOptions?: MonitoringOptions;

  /** Optional caller-owned cancellation signal observed by this interaction. */
  readonly signal?: AbortSignal;

  /** Optional absolute deadline interpreted by the Runtime deadline helper. */
  readonly deadline?: number;

  /** Whether the caller requests a bounded, sanitized raw-response snapshot. */
  readonly includeRawResponse?: boolean;
}
