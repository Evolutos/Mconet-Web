// Copyright © 2026 Mcont.

import type { InteractionMode, ModelTarget, TaskDescriptor } from "@evolutos/mconet-core-domain";
import type { TaskProtocolAdapter } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { scheduleDirectAdapterBranch } from "./schedule-direct-adapter-branch.js";

const target: ModelTarget = {
  serviceId: "service.example",
  protocolId: "protocol.example",
  model: { name: "model-example", metadata: {}, extensions: {} },
  extensions: {},
};
const task: TaskDescriptor = {
  type: "conversation.generate",
  metadata: {},
  extensions: {},
};
const mode: InteractionMode = { id: "unary" };

function adapter(supported: boolean): TaskProtocolAdapter {
  return {
    descriptor: {
      name: "direct-adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: () => supported,
    preparePlan: () => {
      throw new Error("preparePlan");
    },
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

it("forms a direct plan from an injected adapter and skips an absent adapter", () => {
  const direct = adapter(true);
  const plan = scheduleDirectAdapterBranch({ adapter: direct, target, task, mode });

  expect(plan?.source).toBe("direct_adapter");
  expect(plan?.taskProtocolAdapter).toBe(direct);
  expect(scheduleDirectAdapterBranch({ target, task, mode })).toBeUndefined();
  expect(() =>
    scheduleDirectAdapterBranch({ adapter: adapter(false), target, task, mode }),
  ).toThrowError(/does not support/u);
});
