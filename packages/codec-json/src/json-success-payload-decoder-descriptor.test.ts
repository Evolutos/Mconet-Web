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
  expect(jsonSuccessPayloadDecoderDescriptor).toEqual({
    name: "json-success-payload-decoder",
    version: "1.0.0",
    capabilities: new Set(),
    source: "builtin",
  });
  expect(jsonSuccessPayloadDecoderDescriptor.typeContract).toBeUndefined();
});
