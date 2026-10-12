// Copyright © 2026 Mcont.

import type { ModelRequest, ProcessingResult } from "@evolutos/mconet-core-domain";
import type {
  ProtocolExecutionPlan,
  ProtocolRequestPlan,
  TaskProtocolAdapter,
} from "@evolutos/mconet-core-spi";
import { expect, it, vi } from "vitest";

import { scheduleBuildRequest } from "./schedule-build-request.js";

const request = {} as ModelRequest;
const plan = {} as ProtocolExecutionPlan;
const requestPlan: ProtocolRequestPlan = {
  payload: { typeId: "protocol.request", value: { text: "hello" } },
  executionPlan: plan,
};

function adapter(buildRequest: TaskProtocolAdapter["buildRequest"]): TaskProtocolAdapter {
  return {
    descriptor: {
      name: "request-adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: () => {
      throw new Error("supports");
    },
    preparePlan: () => {
      throw new Error("preparePlan");
    },
    buildRequest,
    parseResponse: () => {
      throw new Error("parseResponse");
    },
    parseError: () => {
      throw new Error("parseError");
    },
  };
}

it("returns one request plan and does not encode or send it", () => {
  const buildRequest = vi.fn((): ProcessingResult<ProtocolRequestPlan> => ({
    value: requestPlan,
    diagnostics: [],
  }));

  const result = scheduleBuildRequest({
    adapter: adapter(buildRequest),
    request,
    plan,
  });

  expect(result.value).toBe(requestPlan);
  expect(buildRequest).toHaveBeenCalledOnce();
  expect(buildRequest).toHaveBeenCalledWith({ request, plan });
});

it("returns a planning failure without a second call", () => {
  const failure: ProcessingResult<ProtocolRequestPlan> = {
    diagnostics: [
      {
        code: "request_planning_failed",
        severity: "error",
        phase: "planning",
        message: "The protocol request could not be planned.",
      },
    ],
  };
  const buildRequest = vi.fn(() => failure);

  expect(scheduleBuildRequest({ adapter: adapter(buildRequest), request, plan })).toBe(failure);
  expect(buildRequest).toHaveBeenCalledOnce();
});
