// Copyright © 2026 Mcont.

import type { ComponentTypeContract } from "@evolutos/mconet-core-spi";

import { validateComponentTypeConnection } from "./validate-component-type-connection.js";

/**
 * Schedules type-contract checks for one selected execution chain.
 *
 * The plan's input port produces the request value consumed by the encoder.
 * The encoder produces the transport input, and the transport output feeds both
 * decoders. The success decoder must produce the plan's output port. The error
 * decoder's output is not compared with that success port, because a service
 * error is not a successful response value. The first mismatch throws and later
 * connections are not checked. This stage does not convert payloads or call a
 * component.
 *
 * @param input Plan contract and the contracts declared by the selected components.
 * @throws {ModelInteractionError} When a required connection is missing or incompatible.
 */
export function scheduleTypeContractValidation(input: {
  readonly planTypeContract: ComponentTypeContract;
  readonly payloadEncoder?: ComponentTypeContract;
  readonly transport?: ComponentTypeContract;
  readonly successPayloadDecoder?: ComponentTypeContract;
  readonly errorPayloadDecoder?: ComponentTypeContract;
}): void {
  const encoder = input.payloadEncoder ?? {};
  const transport = input.transport ?? {};
  const successDecoder = input.successPayloadDecoder ?? {};
  const errorDecoder = input.errorPayloadDecoder ?? {};

  // The plan describes the protocol boundary. Its input fields are what the
  // adapter hands to the encoder, so they are projected onto a producer output.
  validateComponentTypeConnection({
    producer: projectProducer(input.planTypeContract),
    consumer: encoder,
  });
  validateComponentTypeConnection({ producer: encoder, consumer: transport });
  validateComponentTypeConnection({ producer: transport, consumer: successDecoder });
  validateComponentTypeConnection({ producer: transport, consumer: errorDecoder });
  validateComponentTypeConnection({
    producer: successDecoder,
    consumer: projectConsumer(input.planTypeContract),
  });
}

/**
 * Projects a plan's input port onto the producer side of a connection.
 *
 * @param contract Plan contract whose input fields describe the request value.
 * @returns A contract that exposes those fields as an output.
 */
function projectProducer(contract: ComponentTypeContract): ComponentTypeContract {
  return {
    ...(contract.inputTypeId === undefined ? {} : { outputTypeId: contract.inputTypeId }),
    ...(contract.inputSchemaId === undefined ? {} : { outputSchemaId: contract.inputSchemaId }),
    ...(contract.inputMediaTypes === undefined
      ? {}
      : { outputMediaTypes: contract.inputMediaTypes }),
  };
}

/**
 * Projects a plan's output port onto the consumer side of a connection.
 *
 * @param contract Plan contract whose output fields describe the success value.
 * @returns A contract that exposes those fields as an input.
 */
function projectConsumer(contract: ComponentTypeContract): ComponentTypeContract {
  return {
    ...(contract.outputTypeId === undefined ? {} : { inputTypeId: contract.outputTypeId }),
    ...(contract.outputSchemaId === undefined ? {} : { inputSchemaId: contract.outputSchemaId }),
    ...(contract.outputMediaTypes === undefined
      ? {}
      : { inputMediaTypes: contract.outputMediaTypes }),
  };
}
