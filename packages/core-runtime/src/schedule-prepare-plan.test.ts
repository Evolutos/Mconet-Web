// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  InteractionMode,
  ModelRequest,
  ProcessingResult,
} from "@evolutos/mconet-core-domain";
import type { ProtocolExecutionPlan, TaskProtocolAdapter } from "@evolutos/mconet-core-spi";
import { expect, it, vi } from "vitest";

import { schedulePreparePlan } from "./schedule-prepare-plan.js";

const request = { target: {}, task: {} } as ModelRequest;
const mode: InteractionMode = { id: "unary" };
const policy: CompatibilityPolicy = { mode: "strict" };
const planned = { transportPlan: {} } as ProtocolExecutionPlan;

function adapter(preparePlan: TaskProtocolAdapter["preparePlan"]): TaskProtocolAdapter {
  return {
    descriptor: {
      name: "plan-adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: () => {
      throw new Error("supports");
    },
    preparePlan,
    buildRequest: () => {
      throw new Error("buildRequest");
    },
    parseResponse: () => {
      throw new Error("parseResponse");
    },
    parseError: () => {
      throw new Error("parseError");
    },
  };
}

it("returns one preparePlan result and does not call it again", () => {
  const preparePlan = vi.fn((): ProcessingResult<ProtocolExecutionPlan> => ({
    value: planned,
    diagnostics: [],
  }));

  const result = schedulePreparePlan({
    adapter: adapter(preparePlan),
    request,
    mode,
    policy,
  });

  expect(result.value).toBe(planned);
  expect(preparePlan).toHaveBeenCalledOnce();
  expect(preparePlan).toHaveBeenCalledWith({ request, mode, policy });
});

it("returns a planning failure without a second call", () => {
  const failure: ProcessingResult<ProtocolExecutionPlan> = {
    diagnostics: [
      {
        code: "planning_failed",
        severity: "error",
        phase: "planning",
        message: "The protocol plan could not be prepared.",
      },
    ],
  };
  const preparePlan = vi.fn(() => failure);

  expect(
    schedulePreparePlan({
      adapter: adapter(preparePlan),
      request,
      mode,
      policy,
    }),
  ).toBe(failure);
  expect(preparePlan).toHaveBeenCalledOnce();
});
