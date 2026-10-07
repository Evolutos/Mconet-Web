// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  InteractionMode,
  ModelTarget,
  TaskDescriptor,
} from "@evolutos/mconet-core-domain";
import type {
  ModelIntegrationPlan,
  ModelIntegrationResolver,
  RuntimeComponent,
} from "@evolutos/mconet-core-spi";

import { defineModelIntegrationResolverContract } from "./model-integration-resolver-contract.js";

/** Registers the shared suite against deterministic in-memory resolver behaviors. */
defineModelIntegrationResolverContract("InMemoryModelIntegrationResolver", () => {
  // Fresh matching tuples and resolver instances keep exact, missing, and tied
  // candidate outcomes independent without introducing another public test double.
  const task: TaskDescriptor = {
    type: "conversation.generate",
    metadata: {},
    extensions: {},
  };
  const mode: InteractionMode = { id: "unary" };
  const policy: CompatibilityPolicy = { mode: "compatible" };
  const createTarget = (modelName: string): ModelTarget => {
    // Vary only the model name so each scenario retains the same protocol and
    // service facts while selecting its configured in-memory resolver outcome.
    return {
      serviceId: "service.contract",
      protocolId: "protocol.contract",
      model: { name: modelName, metadata: {}, extensions: {} },
      extensions: {},
    };
  };
  const exactInput = { target: createTarget("model-exact"), task, mode, policy };
  const noneInput = { target: createTarget("model-none"), task, mode, policy };
  const ambiguousInput = { target: createTarget("model-ambiguous"), task, mode, policy };
  const taskProtocolAdapter: RuntimeComponent = {
    descriptor: {
      name: "contract-task-protocol-adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "plugin",
    },
  };
  const exactPlan: ModelIntegrationPlan = {
    source: "resolved_binding",
    bindingId: "binding.contract.conversation",
    bindingVersion: "1.0.0",
    match: {
      target: { matched: true, score: 400, diagnostics: [] },
      task: { matched: true, score: 200, diagnostics: [] },
    },
    taskProtocolAdapter,
    authorizationHandlers: [],
    payloadEncoders: [],
    payloadDecoders: [],
    transports: [],
    extensions: {},
  };
  const noneError = new Error("no model integration matched the request");
  const ambiguousError = new Error("multiple model integrations matched the request");
  const descriptor: ModelIntegrationResolver["descriptor"] = {
    name: "contract-model-integration-resolver",
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
  };
  const exactResolver: ModelIntegrationResolver = {
    descriptor,
    resolve() {
      // Return the complete fixed plan without I/O, credential access, fallback,
      // or mutation of the labelled matching tuple.
      return exactPlan;
    },
  };
  const noneResolver: ModelIntegrationResolver = {
    descriptor,
    resolve() {
      // Report the stable missing-candidate error without constructing a partial
      // plan or consulting an implicit default integration.
      throw noneError;
    },
  };
  const ambiguousResolver: ModelIntegrationResolver = {
    descriptor,
    resolve() {
      // Reject the tied candidate set without choosing by registration order or
      // returning one arbitrarily selected binding.
      throw ambiguousError;
    },
  };

  // The reusable suite owns all assertions; this factory supplies only complete
  // typed inputs, expected outcomes, and isolated resolver implementations.
  return {
    exactResolver,
    exact: { input: exactInput, expected: exactPlan },
    noneResolver,
    none: { input: noneInput, expected: noneError },
    ambiguousResolver,
    ambiguous: { input: ambiguousInput, expected: ambiguousError },
  };
});
