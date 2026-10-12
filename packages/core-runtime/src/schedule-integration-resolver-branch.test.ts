// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  InteractionMode,
  ModelTarget,
  TaskDescriptor,
} from "@evolutos/mconet-core-domain";
import type { ModelIntegrationPlan, ModelIntegrationResolver } from "@evolutos/mconet-core-spi";
import { expect, it, vi } from "vitest";

import { scheduleIntegrationResolverBranch } from "./schedule-integration-resolver-branch.js";

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
const policy: CompatibilityPolicy = { mode: "compatible" };

const plan = {
  source: "resolved_binding",
  bindingId: "binding.example",
  bindingVersion: "1.0.0",
  taskProtocolAdapter: {
    descriptor: {
      name: "resolved-adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "plugin",
    },
  },
  authorizationHandlers: [],
  payloadEncoders: [],
  payloadDecoders: [],
  transports: [],
  extensions: {},
} as ModelIntegrationPlan;

it("returns the resolver plan from one call and skips an absent resolver", () => {
  const resolve = vi.fn((): ModelIntegrationPlan => plan);
  const resolver = {
    descriptor: {
      name: "resolver",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    resolve,
  } as ModelIntegrationResolver;

  expect(scheduleIntegrationResolverBranch({ resolver, target, task, mode, policy })).toBe(plan);
  expect(resolve).toHaveBeenCalledOnce();
  expect(resolve).toHaveBeenCalledWith({ target, task, mode, policy });
  expect(scheduleIntegrationResolverBranch({ target, task, mode, policy })).toBeUndefined();
});
