// Copyright © 2026 Mcont.

import type { ModelDescriptor } from "@evolutos/mconet-core-domain";

/** Shared empty metadata. Frozen so one descriptor cannot alter another. */
const emptyMetadata: ModelDescriptor["metadata"] = Object.freeze({});

/** Shared empty extensions. Frozen for the same reason as the metadata. */
const emptyExtensions: ModelDescriptor["extensions"] = Object.freeze({});

/**
 * Returns the model the service reported, or no model when it reported none.
 *
 * Absence stays `undefined`. This function does not copy the requested model
 * name into that gap, and it does not split a returned name into family or
 * version. The name is stored exactly, including an empty string.
 *
 * @param model Response `model` text, or `undefined` when the member was omitted.
 * @returns A frozen descriptor, or `undefined` when the service omitted the model.
 * @throws TypeError When `model` is neither a string nor `undefined`.
 */
export function mapWireModelToDomain(model: string | undefined): ModelDescriptor | undefined {
  if (model === undefined) {
    // Omission is the only absence. Do not substitute the model from the request.
    return undefined;
  }
  if (typeof model !== "string") {
    throw new TypeError("Resolved model must be a string or undefined.");
  }

  // Family, version, and display name stay absent. Guessing them from the name
  // would add facts the service did not report.
  return Object.freeze({
    name: model,
    metadata: emptyMetadata,
    extensions: emptyExtensions,
  });
}
