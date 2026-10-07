// Copyright © 2026 Mcont.

import type { MediaType } from "@evolutos/mconet-core-domain";

/**
 * Compares two normalized media types by structural value.
 *
 * Type, subtype, parameter names, and decoded parameter values must match
 * exactly. Parameter insertion order and object identity do not participate.
 * This package-internal primitive keeps Decoder selection and component-port
 * validation on one representation rule without becoming a public extension.
 *
 * @param left First normalized media type.
 * @param right Second normalized media type.
 * @returns Whether both values describe the same representation.
 */
export function mediaTypesEqual(left: MediaType, right: MediaType): boolean {
  // Type and subtype are already normalized by the domain parser. Exact equality
  // avoids broadening a planned representation through implicit case conversion.
  if (left.type !== right.type || left.subtype !== right.subtype) {
    return false;
  }

  const leftParameterNames = Object.keys(left.parameters);
  const rightParameterNames = Object.keys(right.parameters);
  if (leftParameterNames.length !== rightParameterNames.length) {
    // Different cardinality proves that one representation carries an additional
    // parameter even if all names on the smaller side happen to match.
    return false;
  }

  // Compare own decoded values by name so object insertion order and inherited
  // properties cannot affect compatibility.
  return leftParameterNames.every(
    (name) =>
      Object.hasOwn(right.parameters, name) && left.parameters[name] === right.parameters[name],
  );
}
