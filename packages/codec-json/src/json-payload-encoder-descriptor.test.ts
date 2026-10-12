// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { JsonPayloadEncoder } from "./json-payload-encoder.js";
import {
  jsonPayloadEncoderCapabilityId,
  jsonPayloadEncoderDescriptor,
} from "./json-payload-encoder-descriptor.js";

it("publishes one builtin encoder descriptor", () => {
  const first = new JsonPayloadEncoder();
  const second = new JsonPayloadEncoder();

  // Instances share the descriptor so name, version, and source cannot drift.
  expect(first.descriptor).toBe(jsonPayloadEncoderDescriptor);
  expect(second.descriptor).toBe(jsonPayloadEncoderDescriptor);
  expect(jsonPayloadEncoderDescriptor).toMatchObject({
    name: "json-payload-encoder",
    version: "1.0.0",
    source: "builtin",
  });
  expect(jsonPayloadEncoderDescriptor.capabilities).toEqual(
    new Set([jsonPayloadEncoderCapabilityId]),
  );
  expect(jsonPayloadEncoderDescriptor.typeContract).toEqual({
    inputTypeId: "json.value",
    outputTypeId: "codec.bytes",
    inputMediaTypes: [{ type: "application", subtype: "json", parameters: {} }],
  });
});
