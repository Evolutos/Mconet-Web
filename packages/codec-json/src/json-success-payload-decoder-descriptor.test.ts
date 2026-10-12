// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { JsonSuccessPayloadDecoder } from "./json-success-payload-decoder.js";
import { jsonSuccessPayloadDecoderDescriptor } from "./json-success-payload-decoder-descriptor.js";

it("publishes one builtin success decoder descriptor", () => {
  const first = new JsonSuccessPayloadDecoder(64);
  const second = new JsonSuccessPayloadDecoder(64);

  // Instances share the descriptor so name, version, and source cannot drift.
  expect(first.descriptor).toBe(jsonSuccessPayloadDecoderDescriptor);
  expect(second.descriptor).toBe(jsonSuccessPayloadDecoderDescriptor);
  expect(jsonSuccessPayloadDecoderDescriptor).toMatchObject({
    name: "json-success-payload-decoder",
    version: "1.0.0",
    source: "builtin",
  });
  expect(jsonSuccessPayloadDecoderDescriptor.capabilities.size).toBe(0);
  expect(jsonSuccessPayloadDecoderDescriptor.typeContract).toEqual({
    inputTypeId: "codec.bytes",
    outputTypeId: "json.value",
    inputMediaTypes: [{ type: "application", subtype: "json", parameters: {} }],
    outputMediaTypes: [{ type: "application", subtype: "json", parameters: {} }],
  });
});
