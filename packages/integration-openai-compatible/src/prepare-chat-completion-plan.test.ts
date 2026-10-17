// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type {
  Authorization,
  CompatibilityPolicy,
  InteractionMode,
  ModelRequest,
} from "@evolutos/mconet-core-domain";

import { prepareOpenAIChatCompletionPlan } from "./prepare-chat-completion-plan.js";

const policy: CompatibilityPolicy = { mode: "strict" };
const mode: InteractionMode = { id: "unary" };

function request(extra: Partial<ModelRequest> = {}): ModelRequest {
  return {
    target: {
      serviceId: "example",
      protocolId: "openai.chat.completions",
      model: { name: "model-name", metadata: {}, extensions: {} },
      extensions: {},
    },
    task: {
      descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
      document: {} as ModelRequest["task"]["document"],
      artifacts: { artifacts: [] },
      metadata: {},
      extensions: {},
    },
    serviceAccess: {
      endpoint: { kind: "absolute", value: "https://example.test/v1" },
      authorization: { kind: "authorization.none" },
    },
    metadata: {},
    extensions: {},
    ...extra,
  };
}

it("plans POST JSON chat completions without joining the endpoint and path", () => {
  const planned = prepareOpenAIChatCompletionPlan({ request: request(), mode, policy });

  expect(planned.diagnostics).toEqual([]);
  expect(planned.value?.transportPlan.endpoint).toEqual({
    kind: "absolute",
    value: "https://example.test/v1",
  });
  expect(planned.value?.transportPlan.path).toBe("/chat/completions");
  expect(planned.value?.transportPlan.method).toBe("POST");
  expect(planned.value?.transportPlan.endpoint.value).not.toContain("/chat/completions");
  expect(planned.value?.payloadEncoder.mediaType).toEqual({
    type: "application",
    subtype: "json",
    parameters: {},
  });
  expect(planned.value?.successDecoder).not.toBe(planned.value?.errorDecoder);
  expect(planned.value?.typeContract).toEqual({
    inputTypeId: "protocol.openai.chat-request",
    outputTypeId: "protocol.openai.chat-response",
  });
  expect(Object.isFrozen(planned.value)).toBe(true);
});

it("is deterministic and does not read a credential source", () => {
  let reads = 0;
  const authorization = {
    kind: "authorization.bearer",
    credentialSource: {
      getCredential(): never {
        reads += 1;
        throw new Error("credential read");
      },
    },
  } as Authorization;
  const plannedRequest = request({
    serviceAccess: {
      endpoint: { kind: "absolute", value: "https://example.test/v1" },
      authorization,
    },
  });
  const secondInput = {
    request: plannedRequest,
    mode,
    policy: { mode: "compatible" } as CompatibilityPolicy,
  };

  const firstPlan = prepareOpenAIChatCompletionPlan(secondInput);
  const secondPlan = prepareOpenAIChatCompletionPlan(secondInput);

  expect(reads).toBe(0);
  expect(firstPlan.value?.transportPlan.authorization).toBe(authorization);
  expect(secondPlan.value?.transportPlan).toEqual(firstPlan.value?.transportPlan);
  const strictPlan = prepareOpenAIChatCompletionPlan({
    request: plannedRequest,
    mode,
    policy: { mode: "strict" },
  });
  expect(strictPlan.value?.transportPlan).toEqual(firstPlan.value?.transportPlan);
});

it("returns no plan when the protocol, task, or mode does not match", () => {
  const wrongProtocol = request({
    target: {
      serviceId: "example",
      protocolId: "other.protocol",
      model: { name: "model-name", metadata: {}, extensions: {} },
      extensions: {},
    },
  });
  expect(
    prepareOpenAIChatCompletionPlan({ request: wrongProtocol, mode, policy }).diagnostics[0]?.code,
  ).toBe("unsupported_protocol");

  const base = request();
  const wrongTask = request({
    task: {
      ...base.task,
      descriptor: { type: "embedding.generate", metadata: {}, extensions: {} },
    },
  });
  expect(
    prepareOpenAIChatCompletionPlan({ request: wrongTask, mode, policy }).value,
  ).toBeUndefined();
  expect(
    prepareOpenAIChatCompletionPlan({ request: wrongTask, mode, policy }).diagnostics[0]?.code,
  ).toBe("unsupported_task");

  const streamed = prepareOpenAIChatCompletionPlan({
    request: request(),
    mode: { id: "server_stream" },
    policy,
  });
  expect(streamed.diagnostics).toEqual([]);
  expect(streamed.value?.extensions).toEqual({ stream: true });

  const duplex = prepareOpenAIChatCompletionPlan({
    request: request(),
    mode: { id: "duplex" },
    policy,
  });
  expect(duplex.value).toBeUndefined();
  expect(duplex.diagnostics[0]?.code).toBe("unsupported_mode");
});

it("returns no plan when the endpoint or authorization is missing", () => {
  const relative = request({
    serviceAccess: {
      endpoint: { kind: "relative", value: "/v1" },
      authorization: { kind: "authorization.none" },
    },
  });
  expect(
    prepareOpenAIChatCompletionPlan({ request: relative, mode, policy }).diagnostics[0]?.code,
  ).toBe("missing_service_endpoint");

  const noAuthorization = request({
    serviceAccess: { endpoint: { kind: "absolute", value: "https://example.test/v1" } },
  });
  const missing = prepareOpenAIChatCompletionPlan({ request: noAuthorization, mode, policy });
  expect(missing.value).toBeUndefined();
  expect(missing.diagnostics[0]?.code).toBe("missing_authorization");
});
