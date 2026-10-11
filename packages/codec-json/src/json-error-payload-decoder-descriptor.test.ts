// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { JsonErrorPayloadDecoder } from "./json-error-payload-decoder.js";
import {
  jsonErrorPayloadDecoderDescriptor,
  jsonErrorPayloadDecoderTypeContract,
} from "./json-error-payload-decoder-descriptor.js";
import {
  jsonSuccessPayloadDecoderDescriptor,
  jsonSuccessPayloadDecoderTypeContract,
} from "./json-success-payload-decoder-descriptor.js";

it("publishes one builtin error decoder descriptor", () => {
  const first = new JsonErrorPayloadDecoder(64);
  const second = new JsonErrorPayloadDecoder(64);

  // Instances share one descriptor, and that descriptor is not the success one.
  expect(first.descriptor).toBe(jsonErrorPayloadDecoderDescriptor);
  expect(second.descriptor).toBe(jsonErrorPayloadDecoderDescriptor);
  expect(jsonErrorPayloadDecoderDescriptor).not.toBe(jsonSuccessPayloadDecoderDescriptor);
  expect(jsonErrorPayloadDecoderDescriptor).toMatchObject({
    name: "json-error-payload-decoder",
    version: "1.0.0",
    source: "builtin",
  });
  expect(jsonErrorPayloadDecoderDescriptor.capabilities.size).toBe(0);
  expect(jsonErrorPayloadDecoderDescriptor.typeContract).toBe(jsonErrorPayloadDecoderTypeContract);
  expect(jsonErrorPayloadDecoderTypeContract).not.toBe(jsonSuccessPayloadDecoderTypeContract);
  expect(jsonErrorPayloadDecoderTypeContract).toEqual({
    outputTypeId: "json.value",
    outputMediaTypes: [{ type: "application", subtype: "json", parameters: {} }],
  });
});
