// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { ComponentTypeContract } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { scheduleTypeContractValidation } from "./schedule-type-contract-validation.js";

const requestType = "protocol.request";
const responseType = "protocol.response";
const bytesType = "codec.bytes";

function chain(): {
  readonly planTypeContract: ComponentTypeContract;
  readonly payloadEncoder: ComponentTypeContract;
  readonly transport: ComponentTypeContract;
  readonly successPayloadDecoder: ComponentTypeContract;
  readonly errorPayloadDecoder: ComponentTypeContract;
} {
  return {
    planTypeContract: { inputTypeId: requestType, outputTypeId: responseType },
    payloadEncoder: { inputTypeId: requestType, outputTypeId: bytesType },
    transport: { inputTypeId: bytesType, outputTypeId: bytesType },
    successPayloadDecoder: { inputTypeId: bytesType, outputTypeId: responseType },
    errorPayloadDecoder: { inputTypeId: bytesType, outputTypeId: "protocol.error" },
  };
}

it("accepts a chain whose adjacent ports match", () => {
  expect(scheduleTypeContractValidation(chain())).toBeUndefined();
});

it("fails on the first mismatched port and does not read later contracts", () => {
  const contracts = chain();
  const error = captureInteractionError(() => {
    scheduleTypeContractValidation({
      ...contracts,
      payloadEncoder: { inputTypeId: "protocol.other", outputTypeId: bytesType },
      transport: unreadContract(),
    });
  });

  expect(error.code).toBe("invalid_component_type_contract");
  expect(error.phase).toBe("component_type_validation");
});

it("fails when the success decoder does not produce the plan output", () => {
  const contracts = chain();
  const error = captureInteractionError(() => {
    scheduleTypeContractValidation({
      ...contracts,
      successPayloadDecoder: { inputTypeId: bytesType, outputTypeId: "protocol.other" },
    });
  });

  expect(error.code).toBe("invalid_component_type_contract");
});

function unreadContract(): ComponentTypeContract {
  return new Proxy(
    {},
    {
      get(): never {
        throw new Error("A later type contract was read after an earlier mismatch.");
      },
    },
  );
}

function captureInteractionError(action: () => void): ModelInteractionError {
  try {
    action();
  } catch (caught) {
    if (caught instanceof ModelInteractionError) {
      return caught;
    }
    throw caught;
  }
  throw new Error("Expected a model interaction error.");
}
