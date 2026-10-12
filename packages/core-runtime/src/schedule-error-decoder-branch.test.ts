// Copyright © 2026 Mcont.

import type { PayloadDecoder } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { scheduleErrorDecoderBranch } from "./schedule-error-decoder-branch.js";

function decoder(): PayloadDecoder {
  return {
    descriptor: {
      name: "error-decoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    decode: () => {
      throw new Error("decode");
    },
  };
}

it("returns the pre-fixed error decoder only for a service error", () => {
  const errorPayloadDecoder = decoder();

  expect(scheduleErrorDecoderBranch({ outcome: "service_error", errorPayloadDecoder })).toBe(
    errorPayloadDecoder,
  );
  expect(scheduleErrorDecoderBranch({ outcome: "success", errorPayloadDecoder })).toBeUndefined();
  expect(
    scheduleErrorDecoderBranch({ outcome: "transport_error", errorPayloadDecoder }),
  ).toBeUndefined();
});
