// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { JsonErrorPayloadDecoder } from "./json-error-payload-decoder.js";
import { jsonErrorPayloadDecoderDescriptor } from "./json-error-payload-decoder-descriptor.js";
import { jsonSuccessPayloadDecoderDescriptor } from "./json-success-payload-decoder-descriptor.js";

it("publishes one builtin error decoder descriptor", () => {
  const first = new JsonErrorPayloadDecoder(64);
  const second = new JsonErrorPayloadDecoder(64);

  // Instances share one descriptor, and that descriptor is not the success one.
  expect(first.descriptor).toBe(jsonErrorPayloadDecoderDescriptor);
  expect(second.descriptor).toBe(jsonErrorPayloadDecoderDescriptor);
  expect(jsonErrorPayloadDecoderDescriptor).not.toBe(jsonSuccessPayloadDecoderDescriptor);
  expect(jsonErrorPayloadDecoderDescriptor).toEqual({
    name: "json-error-payload-decoder",
    version: "1.0.0",
    capabilities: new Set(),
    source: "builtin",
  });
  expect(jsonErrorPayloadDecoderDescriptor.typeContract).toBeUndefined();
});
