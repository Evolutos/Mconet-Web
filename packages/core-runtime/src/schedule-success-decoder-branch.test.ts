// Copyright © 2026 Mcont.

import type { PayloadDecoder } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { scheduleSuccessDecoderBranch } from "./schedule-success-decoder-branch.js";

function decoder(): PayloadDecoder {
  return {
    descriptor: {
      name: "success-decoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    decode: () => {
      throw new Error("decode");
    },
  };
}

it("returns the pre-fixed success decoder only for a success outcome", () => {
  const successPayloadDecoder = decoder();

  expect(scheduleSuccessDecoderBranch({ outcome: "success", successPayloadDecoder })).toBe(
    successPayloadDecoder,
  );
  expect(
    scheduleSuccessDecoderBranch({ outcome: "service_error", successPayloadDecoder }),
  ).toBeUndefined();
  expect(
    scheduleSuccessDecoderBranch({ outcome: "transport_error", successPayloadDecoder }),
  ).toBeUndefined();
});
