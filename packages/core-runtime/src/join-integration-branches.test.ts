// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  type CompatibilityPolicy,
  type InteractionMode,
  type ModelTarget,
  type TaskDescriptor,
} from "@evolutos/mconet-core-domain";
import type {
  ModelIntegrationPlan,
  ModelIntegrationResolver,
  TaskProtocolAdapter,
} from "@evolutos/mconet-core-spi";
import { expect, it, vi } from "vitest";

import { joinIntegrationBranches } from "./join-integration-branches.js";

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

function adapter(): TaskProtocolAdapter {
  return {
    descriptor: {
      name: "direct-adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: () => true,
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

function resolver(plan: ModelIntegrationPlan): {
  readonly component: ModelIntegrationResolver;
  readonly resolve: ReturnType<typeof vi.fn>;
} {
  const resolve = vi.fn((): ModelIntegrationPlan => plan);
  return {
    resolve,
    component: {
      descriptor: {
        name: "resolver",
        version: "1.0.0",
        capabilities: new Set(),
        source: "application",
      },
      resolve,
    } as ModelIntegrationResolver,
  };
}

const resolvedPlan = {
  source: "resolved_binding",
  bindingId: "binding.example",
  bindingVersion: "1.0.0",
  taskProtocolAdapter: adapter(),
  authorizationHandlers: [],
  payloadEncoders: [],
  payloadDecoders: [],
  transports: [],
  extensions: {},
} as ModelIntegrationPlan;

it("uses an injected adapter and does not call the resolver", () => {
  const direct = adapter();
  const selected = resolver(resolvedPlan);

  const plan = joinIntegrationBranches({
    adapter: direct,
    resolver: selected.component,
    target,
    task,
    mode,
    policy,
  });

  expect(plan.source).toBe("direct_adapter");
  expect(plan.taskProtocolAdapter).toBe(direct);
  expect(selected.resolve).not.toHaveBeenCalled();
});

it("uses the resolver when no adapter is injected", () => {
  const selected = resolver(resolvedPlan);

  expect(
    joinIntegrationBranches({ resolver: selected.component, target, task, mode, policy }),
  ).toBe(resolvedPlan);
  expect(selected.resolve).toHaveBeenCalledOnce();
  expect(selected.resolve).toHaveBeenCalledWith({ target, task, mode, policy });
});

it("fails when neither an adapter nor a resolver is supplied", () => {
  const error = captureInteractionError(() => {
    joinIntegrationBranches({ target, task, mode, policy });
  });

  expect(error.code).toBe("missing_model_integration");
  expect(error.category).toBe("invalid_component_configuration");
  expect(error.phase).toBe("resolution");
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
