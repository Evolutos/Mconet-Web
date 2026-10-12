// Copyright © 2026 Mcont.

import type {
  ComponentRole,
  ComponentSelectionResolution,
  PayloadDecoder,
  PayloadEncoder,
  RuntimeComponent,
  Transport,
} from "@evolutos/mconet-core-spi";

import { resolveSingleComponent } from "./resolve-single-component.js";

/** Role fulfilled by the request payload encoder. */
const payloadEncoderRole: ComponentRole = Object.freeze({ id: "codec.request.encoder" });

/** Role fulfilled by the success-response decoder. */
const successPayloadDecoderRole: ComponentRole = Object.freeze({
  id: "codec.response.success-decoder",
});

/** Role fulfilled by the service-error decoder. */
const errorPayloadDecoderRole: ComponentRole = Object.freeze({
  id: "codec.response.error-decoder",
});

/** Role fulfilled by the unary transport. */
const transportRole: ComponentRole = Object.freeze({ id: "transport.request" });

/** Candidates for one single-value role, in the runtime's fixed precedence. */
interface ComponentCandidates<Component extends RuntimeComponent> {
  readonly interactionComponent?: Component;
  readonly clientComponent?: Component;
  readonly integrationComponents: readonly Component[];
  readonly sdkDefaultComponent?: Component;
}

/**
 * Schedules selection of the single-value components required before I/O.
 *
 * Each role uses the existing precedence: interaction, then client, then exactly
 * one integration candidate, then the SDK default. The result lists encoder,
 * success decoder, error decoder, and transport in that stable order. This
 * stage does not encode, decode, or send, and it does not read a descriptor
 * belonging to a candidate that lost.
 *
 * @param input Labelled candidates for the four required roles.
 * @returns A frozen selection fact for those roles.
 * @throws {ModelInteractionError} When a role has no component or several integration candidates.
 */
export function scheduleComponentSelection(input: {
  readonly payloadEncoder: ComponentCandidates<PayloadEncoder>;
  readonly successPayloadDecoder: ComponentCandidates<PayloadDecoder>;
  readonly errorPayloadDecoder: ComponentCandidates<PayloadDecoder>;
  readonly transport: ComponentCandidates<Transport>;
}): ComponentSelectionResolution {
  // Role order is part of the snapshot. Later stages read by role, not by index,
  // but a stable list keeps two identical selections comparable.
  return Object.freeze({
    components: Object.freeze([
      selectRole(payloadEncoderRole, input.payloadEncoder),
      selectRole(successPayloadDecoderRole, input.successPayloadDecoder),
      selectRole(errorPayloadDecoderRole, input.errorPayloadDecoder),
      selectRole(transportRole, input.transport),
    ]),
  });
}

/**
 * Selects one role and records the winning component's own descriptor.
 *
 * @typeParam Component Concrete component contract for the role.
 * @param role Execution-chain position being filled.
 * @param candidates Labelled tiers for that role.
 * @returns A frozen binding of the role to the selected instance.
 */
function selectRole<Component extends RuntimeComponent>(
  role: ComponentRole,
  candidates: ComponentCandidates<Component>,
): ComponentSelectionResolution["components"][number] {
  const component = resolveSingleComponent({
    role,
    integrationComponents: candidates.integrationComponents,
    ...(candidates.interactionComponent === undefined
      ? {}
      : { interactionComponent: candidates.interactionComponent }),
    ...(candidates.clientComponent === undefined
      ? {}
      : { clientComponent: candidates.clientComponent }),
    ...(candidates.sdkDefaultComponent === undefined
      ? {}
      : { sdkDefaultComponent: candidates.sdkDefaultComponent }),
  });

  return Object.freeze({
    role,
    component,
    descriptor: component.descriptor,
  });
}
