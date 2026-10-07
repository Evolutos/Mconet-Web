// Copyright © 2026 Mcont.

import { ModelInteractionError, type MediaType } from "@evolutos/mconet-core-domain";
import type {
  ComponentRole,
  DecoderSelection,
  PayloadDecoder,
  RuntimeComponent,
} from "@evolutos/mconet-core-spi";

import { resolveSingleComponent } from "./resolve-single-component.js";

/** Stable execution-chain role used by success Decoder diagnostics. */
const successPayloadDecoderRole: ComponentRole = Object.freeze({
  id: "codec.response.success-decoder",
});

/**
 * Selects and validates the payload Decoder fixed for successful responses.
 *
 * Interaction and Client instances are final choices and therefore prevent any
 * lower tier from being inspected. Integration-owned type-erased candidates are
 * narrowed and filtered by the planned input media type and output Schema before
 * the shared single-component resolver applies ambiguity and fallback rules. The
 * SDK default is selected only when no direct instance exists and the integration
 * tier has no compatible candidate. Every returned Decoder satisfies the planned
 * criteria before network I/O.
 *
 * @param input Planned success criteria and candidates from every priority tier.
 * @returns The original uniquely selected success Decoder instance.
 * @throws {ModelInteractionError} When candidates are malformed, incompatible,
 * absent, or ambiguous at the active priority tier.
 */
export function selectSuccessPayloadDecoder(
  input: Readonly<{
    readonly selection: DecoderSelection;
    readonly interactionDecoder?: PayloadDecoder;
    readonly clientDecoder?: PayloadDecoder;
    readonly integrationDecoders: readonly RuntimeComponent[];
    readonly sdkDefaultDecoder?: PayloadDecoder;
  }>,
): PayloadDecoder {
  // Higher direct choices are final and mask every lower tier. Avoid inspecting
  // integration descriptors when their candidates cannot affect the result.
  const integrationDecoders =
    input.interactionDecoder === undefined && input.clientDecoder === undefined
      ? collectCompatibleIntegrationDecoders(input.integrationDecoders, input.selection)
      : [];

  // Reuse the shared fixed-precedence resolver so same-tier ambiguity, required
  // absence, and source priority retain one stable implementation across roles.
  const selectedDecoder = resolveSingleComponent<PayloadDecoder>({
    role: successPayloadDecoderRole,
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
    throw createIncompatibleSuccessDecoderError(input.selection);
  }

  return selectedDecoder;
}

/** Narrows and retains compatible integration-owned Decoder candidates. */
function collectCompatibleIntegrationDecoders(
  components: readonly RuntimeComponent[],
  selection: DecoderSelection,
): readonly PayloadDecoder[] {
  const compatibleDecoders: PayloadDecoder[] = [];

  // Preserve declaration order for diagnostics only. Selection never uses the
  // first match as a winner: the shared resolver rejects multiple matches.
  for (const component of components) {
    if (!isPayloadDecoder(component)) {
      // The integration plan promises Decoder candidates. A different behavior
      // contract is malformed configuration rather than an ignorable mismatch.
      throw createInvalidSuccessDecoderCandidateError();
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

/** Matches one Decoder's declared ports against planned success criteria. */
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

/** Compares normalized media types without depending on parameter insertion order. */
function mediaTypesEqual(left: MediaType, right: MediaType): boolean {
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

/** Creates the stable failure for a malformed integration Decoder candidate. */
function createInvalidSuccessDecoderCandidateError(): ModelInteractionError {
  // Do not include the component name, implementation, or descriptor because a
  // malformed candidate may expose untrusted or sensitive diagnostic metadata.
  return new ModelInteractionError({
    message: "A success Decoder candidate does not implement Decoder behavior.",
    category: "invalid_component_configuration",
    phase: "component_type_validation",
    code: "invalid_component_type_contract",
    diagnostics: [
      {
        code: "invalid_component_type_contract",
        severity: "error",
        phase: "component_type_validation",
        message: "The success Decoder role received a component with incompatible behavior.",
        details: { roleId: successPayloadDecoderRole.id },
      },
    ],
  });
}

/** Creates the stable failure for a selected Decoder that violates the plan. */
function createIncompatibleSuccessDecoderError(selection: DecoderSelection): ModelInteractionError {
  // Report only which evidence was required. Media parameters and Schema IDs are
  // unnecessary for classification and remain outside diagnostics.
  return new ModelInteractionError({
    message: "The selected success Decoder does not satisfy the protocol plan.",
    category: "invalid_component_configuration",
    phase: "component_type_validation",
    code: "component_type_mismatch",
    diagnostics: [
      {
        code: "component_type_mismatch",
        severity: "error",
        phase: "component_type_validation",
        message: "The selected success Decoder has an incompatible port contract.",
        details: {
          roleId: successPayloadDecoderRole.id,
          mediaTypeRequired: selection.mediaType !== undefined,
          schemaIdRequired: selection.schemaId !== undefined,
        },
      },
    ],
  });
}
