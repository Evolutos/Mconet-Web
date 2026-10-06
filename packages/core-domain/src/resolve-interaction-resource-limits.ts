// Copyright © 2026 Mcont.

import {
  isInteractionResourceLimits,
  type InteractionResourceLimits,
} from "./interaction-resource-limits.js";
import type { ResolvedInteractionResourceLimits } from "./resolved-interaction-resource-limits.js";

/** Resource-limit fields copied from validated source layers. */
const resourceLimitFieldNames = [
  "maxResponseBodyBytes",
  "maxStreamingErrorBodyBytes",
  "maxFrameBytes",
] as const satisfies readonly (keyof InteractionResourceLimits)[];

/**
 * Resolves complete interaction byte limits from three precedence layers.
 *
 * Every supplied layer is validated before selection, including lower-priority
 * values replaced by an interaction override. Each field then independently
 * selects the interaction value, the reusable client value, or the required SDK
 * default. Source objects are never modified, and the returned snapshot is
 * frozen for use throughout one interaction.
 *
 * @param sdkDefaults Complete finite defaults selected by the SDK composition root.
 * @param clientLimits Optional reusable client-level field overrides.
 * @param interactionLimits Optional overrides for only the current interaction.
 * @returns A new frozen snapshot containing all three effective byte limits.
 * @throws {TypeError} When any supplied layer is invalid or SDK defaults are incomplete.
 */
export function resolveInteractionResourceLimits(
  sdkDefaults: ResolvedInteractionResourceLimits,
  clientLimits?: InteractionResourceLimits,
  interactionLimits?: InteractionResourceLimits,
): ResolvedInteractionResourceLimits {
  // Snapshot all present layers before selecting winners. This validates even
  // overridden values and prevents later caller mutation from changing a field
  // while the result is being assembled.
  const defaults = snapshotResourceLimits(sdkDefaults, "sdkDefaults", true);
  const client =
    clientLimits === undefined
      ? undefined
      : snapshotResourceLimits(clientLimits, "clientLimits", false);
  const interaction =
    interactionLimits === undefined
      ? undefined
      : snapshotResourceLimits(interactionLimits, "interactionLimits", false);

  // Resolve every dimension independently. Nullish selection is intentional:
  // validated byte counts are positive, while absence alone falls through to
  // the next lower-priority layer.
  return Object.freeze({
    maxResponseBodyBytes:
      interaction?.maxResponseBodyBytes ??
      client?.maxResponseBodyBytes ??
      defaults.maxResponseBodyBytes,
    maxStreamingErrorBodyBytes:
      interaction?.maxStreamingErrorBodyBytes ??
      client?.maxStreamingErrorBodyBytes ??
      defaults.maxStreamingErrorBodyBytes,
    maxFrameBytes: interaction?.maxFrameBytes ?? client?.maxFrameBytes ?? defaults.maxFrameBytes,
  });
}

function snapshotResourceLimits(
  value: unknown,
  layerName: string,
  requireComplete: true,
): ResolvedInteractionResourceLimits;
function snapshotResourceLimits(
  value: unknown,
  layerName: string,
  requireComplete: false,
): InteractionResourceLimits;

/** Captures one validated layer without evaluating property accessors. */
function snapshotResourceLimits(
  value: unknown,
  layerName: string,
  requireComplete: boolean,
): InteractionResourceLimits {
  // Apply the shared public predicate first so every layer obeys the same
  // positive-safe-integer contract used at other configuration boundaries.
  if (!isInteractionResourceLimits(value)) {
    throw new TypeError(`${layerName} must be a valid resource-limit object.`);
  }

  let descriptors: Record<string, PropertyDescriptor>;
  try {
    // Capture own data descriptors without invoking getters. A second guarded
    // reflection also closes the gap for a Proxy that changes after validation.
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new TypeError(`${layerName} must be a valid resource-limit object.`);
  }

  const snapshot: {
    maxResponseBodyBytes?: number;
    maxStreamingErrorBodyBytes?: number;
    maxFrameBytes?: number;
  } = {};

  // Copy only known own fields into an ordinary object. Revalidating descriptor
  // values makes the captured snapshot authoritative even for stateful Proxies.
  for (const fieldName of resourceLimitFieldNames) {
    const descriptor = descriptors[fieldName];
    if (descriptor === undefined) {
      continue;
    }
    if (
      !("value" in descriptor) ||
      !Number.isSafeInteger(descriptor.value) ||
      descriptor.value <= 0
    ) {
      throw new TypeError(`${layerName} must be a valid resource-limit object.`);
    }
    snapshot[fieldName] = descriptor.value;
  }

  // The SDK tier is the final fallback and therefore must own every field.
  // Narrowing each property together proves the returned complete shape without
  // an unsafe type assertion or an implicit unlimited value.
  if (requireComplete) {
    const { maxResponseBodyBytes, maxStreamingErrorBodyBytes, maxFrameBytes } = snapshot;
    if (
      maxResponseBodyBytes === undefined ||
      maxStreamingErrorBodyBytes === undefined ||
      maxFrameBytes === undefined
    ) {
      throw new TypeError(`${layerName} must contain every resource-limit field.`);
    }
    return Object.freeze({
      maxResponseBodyBytes,
      maxStreamingErrorBodyBytes,
      maxFrameBytes,
    });
  }

  // Freeze the private copy so resolution always reads one stable view of a
  // caller-owned layer, even if the original object is mutated concurrently.
  return Object.freeze(snapshot);
}
