// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { JsonPayloadEncoder } from "./json-payload-encoder.js";
import { jsonPayloadEncoderDescriptor } from "./json-payload-encoder-descriptor.js";

it("publishes one builtin encoder descriptor", () => {
  const first = new JsonPayloadEncoder();
  const second = new JsonPayloadEncoder();

  // Instances share the descriptor so name, version, and source cannot drift.
  expect(first.descriptor).toBe(jsonPayloadEncoderDescriptor);
  expect(second.descriptor).toBe(jsonPayloadEncoderDescriptor);
  expect(jsonPayloadEncoderDescriptor).toEqual({
    name: "json-payload-encoder",
    version: "1.0.0",
    capabilities: new Set(),
    source: "builtin",
  });
  expect(jsonPayloadEncoderDescriptor.typeContract).toBeUndefined();
});
