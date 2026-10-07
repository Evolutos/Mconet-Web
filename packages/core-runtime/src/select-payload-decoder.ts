// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type {
  ComponentRole,
  DecoderSelection,
  PayloadDecoder,
  RuntimeComponent,
} from "@evolutos/mconet-core-spi";

import { resolveSingleComponent } from "./resolve-single-component.js";
import { mediaTypesEqual } from "./media-types-equal.js";

/**
 * Applies the shared deterministic algorithm for one planned Decoder role.
 *
 * This package-internal function centralizes precedence, type-erasure recovery,
 * port matching, ambiguity handling, and safe errors for the public success and
 * error role wrappers. Callers supply one stable role and never expose this helper
 * as an injectable resolver. Every returned Decoder is fixed before network I/O.
 *
 * @param input Role, planned criteria, and candidates from every priority tier.
 * @returns The original uniquely selected Decoder instance.
 * @throws {ModelInteractionError} When candidates are malformed, incompatible,
 * absent, or ambiguous at the active priority tier.
 */
export function selectPayloadDecoder(
  input: Readonly<{
    readonly role: ComponentRole;
    readonly selection: DecoderSelection;
    readonly interactionDecoder: PayloadDecoder | undefined;
    readonly clientDecoder: PayloadDecoder | undefined;
    readonly integrationDecoders: readonly RuntimeComponent[];
    readonly sdkDefaultDecoder: PayloadDecoder | undefined;
  }>,
): PayloadDecoder {
  // Higher direct choices are final and mask every lower tier. Avoid inspecting
  // integration descriptors when their candidates cannot affect the result.
  const integrationDecoders =
    input.interactionDecoder === undefined && input.clientDecoder === undefined
      ? collectCompatibleIntegrationDecoders(input.integrationDecoders, input.selection, input.role)
      : [];

  // Reuse the shared fixed-precedence resolver so same-tier ambiguity, required
  // absence, and source priority retain one stable implementation across roles.
  const selectedDecoder = resolveSingleComponent<PayloadDecoder>({
    role: input.role,
    integrationComponents: integrationDecoders,
    // Preserve exact optional-property semantics: an absent tier is omitted from
    // the resolver input instead of becoming an own property holding undefined.
    ...(input.interactionDecoder === undefined
      ? {}
      : { interactionComponent: input.interactionDecoder }),
    ...(input.clientDecoder === undefined ? {} : { clientComponent: input.clientDecoder }),
    ...(input.sdkDefaultDecoder === undefined
      ? {}
      : { sdkDefaultComponent: input.sdkDefaultDecoder }),
  });

  // Integration candidates already matched during filtering. Rechecking the
  // selected value also validates final direct and SDK-default choices without
  // allowing an incompatible explicit instance to fall through to a lower tier.
  if (!matchesDecoderSelection(selectedDecoder, input.selection)) {
    throw createIncompatibleDecoderError(input.role, input.selection);
  }

  return selectedDecoder;
}

/** Narrows and retains compatible integration-owned Decoder candidates. */
function collectCompatibleIntegrationDecoders(
  components: readonly RuntimeComponent[],
  selection: DecoderSelection,
  role: ComponentRole,
): readonly PayloadDecoder[] {
  const compatibleDecoders: PayloadDecoder[] = [];

  // Preserve declaration order for diagnostics only. Selection never uses the
  // first match as a winner: the shared resolver rejects multiple matches.
  for (const component of components) {
    if (!isPayloadDecoder(component)) {
      // The integration plan promises Decoder candidates. A different behavior
      // contract is malformed configuration rather than an ignorable mismatch.
      throw createInvalidDecoderCandidateError(role);
    }

    if (matchesDecoderSelection(component, selection)) {
      // Retain the exact implementation instance; no wrapper, clone, registry
      // lookup, or descriptor-derived reconstruction is introduced.
      compatibleDecoders.push(component);
    }
  }

  return compatibleDecoders;
}

/** Determines whether a type-erased component exposes Decoder behavior. */
function isPayloadDecoder(component: RuntimeComponent): component is PayloadDecoder {
  // RuntimeComponent intentionally erases role-specific methods. The property
  // check restores only the callable Decoder boundary without an unsafe cast.
  return "decode" in component && typeof component.decode === "function";
}

/** Matches one Decoder's declared ports against planned response criteria. */
function matchesDecoderSelection(decoder: PayloadDecoder, selection: DecoderSelection): boolean {
  // An unconstrained plan accepts any correctly shaped Decoder and does not read
  // descriptor metadata that cannot influence the result.
  if (selection.mediaType === undefined && selection.schemaId === undefined) {
    return true;
  }

  const contract = decoder.descriptor.typeContract;
  if (contract === undefined) {
    // Required evidence cannot be inferred from names, capabilities, source, or
    // implementation behavior when the component omitted its port contract.
    return false;
  }

  // Decoder input consumes response bytes in the planned wire representation.
  // Missing or nonmatching input media evidence makes this candidate incompatible.
  const plannedMediaType = selection.mediaType;
  if (
    plannedMediaType !== undefined &&
    !contract.inputMediaTypes?.some((mediaType) => mediaTypesEqual(mediaType, plannedMediaType))
  ) {
    return false;
  }

  // Decoder output produces the erased payload expected by the protocol. Only
  // output Schema evidence participates; an input Schema cannot substitute for it.
  return selection.schemaId === undefined || contract.outputSchemaId === selection.schemaId;
}

/** Creates the stable failure for a malformed integration Decoder candidate. */
function createInvalidDecoderCandidateError(role: ComponentRole): ModelInteractionError {
  // Do not include the component name, implementation, or descriptor because a
  // malformed candidate may expose untrusted or sensitive diagnostic metadata.
  return new ModelInteractionError({
    message: "A Decoder candidate does not implement Decoder behavior.",
    category: "invalid_component_configuration",
    phase: "component_type_validation",
    code: "invalid_component_type_contract",
    diagnostics: [
      {
        code: "invalid_component_type_contract",
        severity: "error",
        phase: "component_type_validation",
        message: "A Decoder role received a component with incompatible behavior.",
        details: { roleId: role.id },
      },
    ],
  });
}

/** Creates the stable failure for a selected Decoder that violates its plan. */
function createIncompatibleDecoderError(
  role: ComponentRole,
  selection: DecoderSelection,
): ModelInteractionError {
  // Report only which evidence was required. Media parameters and Schema IDs are
  // unnecessary for classification and remain outside diagnostics.
  return new ModelInteractionError({
    message: "The selected Decoder does not satisfy the protocol plan.",
    category: "invalid_component_configuration",
    phase: "component_type_validation",
    code: "component_type_mismatch",
    diagnostics: [
      {
        code: "component_type_mismatch",
        severity: "error",
        phase: "component_type_validation",
        message: "The selected Decoder has an incompatible port contract.",
        details: {
          roleId: role.id,
          mediaTypeRequired: selection.mediaType !== undefined,
          schemaIdRequired: selection.schemaId !== undefined,
        },
      },
    ],
  });
}
