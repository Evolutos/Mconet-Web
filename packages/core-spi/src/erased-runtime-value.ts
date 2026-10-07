// Copyright © 2026 Mcont.

import type { OpenIdentifier } from "@evolutos/mconet-core-domain";

/**
 * Immutable runtime value paired with explicit semantic and representation IDs.
 *
 * The payload remains unknown until a validated component boundary narrows it.
 * Keeping identity beside the erased value allows Runtime connection checks
 * without introducing generics across replaceable components or permitting an
 * unchecked cast. This envelope contains no validator, component, capability,
 * transport metadata, ownership, selection result, or mutable request state.
 */
export interface ErasedRuntimeValue {
  /** Semantic identity describing what the erased value represents. */
  readonly typeId: OpenIdentifier;

  /** Optional Schema identity describing the value's concrete representation. */
  readonly schemaId?: string;

  /** Opaque payload that requires validated boundary-specific narrowing before use. */
  readonly value: unknown;
}
