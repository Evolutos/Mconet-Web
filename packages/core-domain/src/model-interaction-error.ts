// Copyright © 2026 Mcont.

import type { Diagnostic } from "./diagnostic.js";
import type { ErrorCategory } from "./error-category.js";
import type { InteractionPhase } from "./interaction-phase.js";
import type { RecoveryHint } from "./recovery-hint.js";

/**
 * Standard error raised when a model interaction cannot complete successfully.
 *
 * The class preserves structured classification, phase, service metadata,
 * recovery facts, diagnostics, and an unknown cause without exposing platform-
 * specific error types in its public contract. Its technical message is not
 * intended to be displayed directly as final user-facing content.
 */
export class ModelInteractionError extends Error {
  /** Stable high-level failure classification. */
  public readonly category: ErrorCategory;

  /** Interaction pipeline stage in which the failure originated. */
  public readonly phase: InteractionPhase;

  /** Stable machine-readable error code. */
  public readonly code: string;

  /** Optional HTTP-style response status associated with the failure. */
  declare public readonly statusCode?: number;

  /** Optional provider or service error code preserved without reinterpretation. */
  declare public readonly serviceErrorCode?: string;

  /** Optional request correlation identifier reported by the service. */
  declare public readonly requestId?: string;

  /** Optional recovery facts reported by the failing component. */
  declare public readonly recovery?: RecoveryHint;

  /** Immutable diagnostic snapshot collected for the failure. */
  public readonly diagnostics: readonly Diagnostic[];

  /** Original failure value, retained as unknown rather than unsafely narrowed. */
  public override readonly cause?: unknown;

  /**
   * Creates a fully classified model interaction error.
   *
   * @param options Complete required error fields and any known optional context.
   */
  public constructor(options: {
    /** Technical error summary. */
    readonly message: string;
    /** Stable high-level failure classification. */
    readonly category: ErrorCategory;
    /** Pipeline stage that produced the failure. */
    readonly phase: InteractionPhase;
    /** Stable machine-readable error code. */
    readonly code: string;
    /** Optional HTTP-style response status. */
    readonly statusCode?: number;
    /** Optional provider or service error code. */
    readonly serviceErrorCode?: string;
    /** Optional request correlation identifier. */
    readonly requestId?: string;
    /** Optional recovery facts. */
    readonly recovery?: RecoveryHint;
    /** Diagnostics collected for this failure. */
    readonly diagnostics: readonly Diagnostic[];
    /** Original failure value, if one exists. */
    readonly cause?: unknown;
  }) {
    // Initialize the standard Error message and stack before adding structured
    // domain fields. Cause receives its descriptor below after class fields run.
    super(options.message);

    // Give stack traces and string conversion a stable domain-specific error
    // name while preserving the message initialized by the Error constructor.
    this.name = "ModelInteractionError";

    // Copy every required classification field exactly once so the instance is
    // complete immediately after construction and cannot be reclassified later.
    this.category = options.category;
    this.phase = options.phase;
    this.code = options.code;

    // Snapshot and freeze the diagnostic collection so subsequent mutation of
    // the caller's source array cannot change the error's recorded diagnostics.
    this.diagnostics = Object.freeze([...options.diagnostics]);

    // A declared override cannot combine TypeScript's `declare` and `override`
    // modifiers, so the emitted optional field initially creates an undefined
    // own property. Replace it with a non-enumerable readonly descriptor when a
    // cause exists, or remove the placeholder to preserve true optional absence.
    if (Object.hasOwn(options, "cause")) {
      Object.defineProperty(this, "cause", {
        configurable: false,
        enumerable: false,
        value: options.cause,
        writable: false,
      });
    } else {
      Reflect.deleteProperty(this, "cause");
    }

    // Materialize optional metadata only when supplied. This preserves the
    // observable distinction between an unknown field and an own undefined value.
    if (options.statusCode !== undefined) {
      this.statusCode = options.statusCode;
    }
    if (options.serviceErrorCode !== undefined) {
      this.serviceErrorCode = options.serviceErrorCode;
    }
    if (options.requestId !== undefined) {
      this.requestId = options.requestId;
    }
    if (options.recovery !== undefined) {
      this.recovery = options.recovery;
    }
  }
}
