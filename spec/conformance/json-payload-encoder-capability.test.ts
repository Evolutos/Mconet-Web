// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type { CapabilityRequirement } from "../../packages/core-spi/src/capability-requirement.js";
import type { ComponentSelectionResolution } from "../../packages/core-spi/src/component-selection-resolution.js";
import { JsonPayloadEncoder } from "../../packages/codec-json/src/json-payload-encoder.js";
import { jsonPayloadEncoderCapabilityId } from "../../packages/codec-json/src/json-payload-encoder-descriptor.js";
import { resolveRequiredCapabilities } from "../../packages/core-runtime/src/resolve-required-capabilities.js";

/** Required JSON encode capability requested by an execution plan. */
const encodeRequirement: CapabilityRequirement = {
  capabilityId: jsonPayloadEncoderCapabilityId,
  required: true,
};

/** Builds a selection that contains only the JSON payload encoder. */
function encoderSelection(): ComponentSelectionResolution {
  const encoder = new JsonPayloadEncoder();
  return {
    components: [
      {
        role: { id: "codec.request.encoder" },
        component: encoder,
        descriptor: encoder.descriptor,
      },
    ],
  };
}

it("resolves required JSON encoding from the encoder descriptor", () => {
  const resolution = resolveRequiredCapabilities({
    requirements: [encodeRequirement],
    componentSelection: encoderSelection(),
  });

  // The satisfied fact is the original requirement, not a synthesized provider.
  expect(resolution.satisfied).toEqual([encodeRequirement]);
  expect(resolution.diagnostics).toEqual([]);
});

it("fails required JSON encoding when the encoder is not selected", () => {
  expect(() =>
    resolveRequiredCapabilities({
      requirements: [encodeRequirement],
      componentSelection: { components: [] },
    }),
  ).toThrowError(expect.objectContaining({ code: "unsupported_capability" }));
});
