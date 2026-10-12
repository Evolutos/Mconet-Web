// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type { ComponentSelectionResolution } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { scheduleCapabilityValidation } from "./schedule-capability-validation.js";

const bounded = "transport.response.bounded";

function selection(capabilities: readonly string[]): ComponentSelectionResolution {
  return {
    components: [
      {
        role: { id: "transport.request" },
        component: {
          descriptor: {
            name: "transport",
            version: "1.0.0",
            capabilities: new Set(),
            source: "builtin",
          },
        },
        descriptor: {
          name: "transport",
          version: "1.0.0",
          capabilities: new Set(capabilities),
          source: "builtin",
        },
      },
    ],
  };
}

it("accepts a required capability declared by the selected component", () => {
  const resolution = scheduleCapabilityValidation({
    transportCapabilities: new Set([bounded]),
    modeComponents: [],
    componentSelection: selection([bounded]),
  });

  expect(resolution.satisfied.map((requirement) => requirement.capabilityId)).toEqual([bounded]);
});

it("fails when a required transport capability is missing", () => {
  const error = captureInteractionError(() => {
    scheduleCapabilityValidation({
      transportCapabilities: new Set([bounded]),
      modeComponents: [
        {
          role: { id: "mode.stream" },
          required: true,
          requiredCapabilities: new Set(["mode.stream.frames"]),
        },
      ],
      componentSelection: selection([]),
    });
  });

  expect(error.code).toBe("unsupported_capability");
  expect(error.diagnostics[0]?.details).toEqual({ capabilityId: bounded });
});

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
