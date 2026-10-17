// Copyright © 2026 Mcont.

import {
  validateTextInteractionModeSupport,
  type InteractionMode,
  type MediaType,
  type ProcessingResult,
} from "@evolutos/mconet-core-domain";
import type { ProtocolExecutionPlan } from "@evolutos/mconet-core-spi";

/** Stable code when a planned media type is not JSON. */
const unsupportedMediaTypeCode = "unsupported_media_type";

/** Stable code when the plan is not an HTTP call. */
const unsupportedTransportCode = "unsupported_transport";

/** Transport family accepted by the R1 execution path. Omission also means HTTP. */
const httpTransportKind = "transport.http";

/** Subtype that means JSON without a structured suffix. */
const jsonSubtype = "json";

/** Structured syntax suffix for a JSON representation. */
const jsonStructuredSuffix = "+json";

/** HTTP methods the R1 path will send. Matching is exact and uppercase. */
const httpMethods = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "DELETE",
  "CONNECT",
  "OPTIONS",
  "TRACE",
  "PATCH",
]);

/**
 * Guards one execution plan against the R1 unary JSON HTTP scope.
 *
 * The first mismatch stops the guard. A passing plan is returned by the same
 * reference. This stage does not rewrite the plan, select a component, or
 * call a transport.
 *
 * @param input Interaction mode and the plan produced for that mode.
 * @returns The same plan, or diagnostics and no value.
 */
export function validateR1PlanScope(input: {
  readonly mode: InteractionMode;
  readonly plan: ProtocolExecutionPlan;
}): ProcessingResult<ProtocolExecutionPlan> {
  const modeResult = validateTextInteractionModeSupport(input.mode);
  if (modeResult.value === undefined) {
    // Client stream, duplex, and long-running modes stay outside this path.
    return { diagnostics: modeResult.diagnostics };
  }

  const mediaFailure = validateJsonMedia(input.plan);
  if (mediaFailure !== undefined) {
    return mediaFailure;
  }

  const transportFailure = validateHttpTransport(input.plan);
  if (transportFailure !== undefined) {
    return transportFailure;
  }

  return { diagnostics: [], value: input.plan };
}

/**
 * Requires JSON media types on the encoder and both decoders.
 *
 * @param plan Plan whose selection criteria are inspected.
 * @returns A failure result, or `undefined` when every media type is JSON.
 */
function validateJsonMedia(
  plan: ProtocolExecutionPlan,
): ProcessingResult<ProtocolExecutionPlan> | undefined {
  const selections = [
    ["payloadEncoder.mediaType", plan.payloadEncoder.mediaType],
    ["successDecoder.mediaType", plan.successDecoder.mediaType],
    ["errorDecoder.mediaType", plan.errorDecoder.mediaType],
  ] as const;

  for (const [path, mediaType] of selections) {
    if (!isJsonMediaType(mediaType)) {
      return failure(unsupportedMediaTypeCode, "R1 execution requires a JSON media type.", path);
    }
  }
  return undefined;
}

/**
 * Requires an HTTP method, an http(s) endpoint, and no non-HTTP transport kind.
 *
 * @param plan Plan whose transport requirements are inspected.
 * @returns A failure result, or `undefined` when the plan is HTTP.
 */
function validateHttpTransport(
  plan: ProtocolExecutionPlan,
): ProcessingResult<ProtocolExecutionPlan> | undefined {
  const transportKind = plan.transport.transportKind;
  if (transportKind !== undefined && transportKind !== httpTransportKind) {
    return failure(
      unsupportedTransportCode,
      "R1 execution requires an HTTP transport.",
      "transport.transportKind",
    );
  }
  if (!httpMethods.has(plan.transportPlan.method)) {
    return failure(
      unsupportedTransportCode,
      "R1 execution requires an HTTP method.",
      "transportPlan.method",
    );
  }
  if (!hasHttpScheme(plan.transportPlan.endpoint.value)) {
    return failure(
      unsupportedTransportCode,
      "R1 execution requires an http(s) endpoint.",
      "transportPlan.endpoint",
    );
  }
  return undefined;
}

/**
 * Returns whether a structured media type is JSON or a JSON structured suffix.
 *
 * @param mediaType Planned media type, when the plan supplied one.
 * @returns Whether the subtype is `json` or a non-empty prefix plus `+json`.
 */
function isJsonMediaType(mediaType: MediaType | undefined): boolean {
  if (mediaType === undefined) {
    return false;
  }
  if (mediaType.subtype === jsonSubtype) {
    return true;
  }
  return (
    mediaType.subtype.endsWith(jsonStructuredSuffix) &&
    mediaType.subtype.length > jsonStructuredSuffix.length
  );
}

/**
 * Returns whether an absolute endpoint uses the http or https scheme.
 *
 * @param value Endpoint text already stored as an absolute URI.
 * @returns Whether the scheme is `http:` or `https:`.
 */
function hasHttpScheme(value: string): boolean {
  const scheme = value.slice(0, "https://".length).toLowerCase();
  return scheme.startsWith("https://") || scheme.startsWith("http://");
}

/**
 * Returns a scope failure with one error and no plan.
 *
 * @param code Stable diagnostic code.
 * @param message Technical summary that does not echo the endpoint.
 * @param path Field that failed.
 * @returns A processing result without a value.
 */
function failure(
  code: string,
  message: string,
  path: string,
): ProcessingResult<ProtocolExecutionPlan> {
  return {
    diagnostics: [
      {
        code,
        severity: "error",
        phase: "validation",
        message,
        path,
      },
    ],
  };
}
