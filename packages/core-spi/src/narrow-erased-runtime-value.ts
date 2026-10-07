// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import type { ErasedRuntimeValue } from "./erased-runtime-value.js";

/**
 * Narrows an erased payload through one explicit synchronous runtime guard.
 *
 * Callers must validate the producing and consuming ComponentTypeContract before
 * invoking this final native-value boundary. The guard verifies the platform
 * runtime shape that portable type and Schema IDs cannot prove by themselves.
 * A false result or thrown guard failure becomes the same content-safe standard
 * component error; the helper never returns an unchecked cast or payload copy.
 *
 * @typeParam Value Runtime value type proven by the supplied guard.
 * @param erased Erased value whose payload must be narrowed.
 * @param isValue Total synchronous guard for the consuming component's value type.
 * @returns The exact enclosed payload after the guard proves its type.
 * @throws {ModelInteractionError} With `component_type_mismatch` when narrowing fails.
 */
export function narrowErasedRuntimeValue<Value>(
  erased: ErasedRuntimeValue,
  isValue: (value: unknown) => value is Value,
): Value {
  try {
    // Capture the payload once so an accessor-backed dynamic object cannot show
    // one value to the guard and a different value to the successful return.
    const candidate = erased.value;
    if (isValue(candidate)) {
      // The type predicate proves the local candidate and returning it preserves
      // exact payload identity without reading metadata or applying a cast.
      return candidate;
    }
  } catch {
    // Treat guard or value-access exceptions as the same boundary mismatch. Do
    // not attach the original exception because it may retain payload content.
    throw createComponentTypeMismatchError();
  }

  // A normal false result uses the same error as an exceptional guard so callers
  // receive one deterministic failure contract independent of predicate details.
  throw createComponentTypeMismatchError();
}

/** Creates a fresh content-safe standard error for one failed runtime narrowing. */
function createComponentTypeMismatchError(): ModelInteractionError {
  // Omit value representations, type and Schema IDs, guard names, and causes so
  // producer-controlled or sensitive payload facts cannot enter diagnostics.
  return new ModelInteractionError({
    category: "invalid_component_configuration",
    phase: "component_type_validation",
    code: "component_type_mismatch",
    message: "Erased runtime value does not match the requested runtime type.",
    diagnostics: [],
  });
}
