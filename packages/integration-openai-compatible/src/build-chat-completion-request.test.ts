// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import type {
  Authorization,
  MessageDocument,
  MessageEntry,
  MessageGroup,
  ModelRequest,
} from "@evolutos/mconet-core-domain";
import type { ProtocolExecutionPlan } from "@evolutos/mconet-core-spi";

import { buildOpenAIChatCompletionRequest } from "./build-chat-completion-request.js";

const plan = { marker: "plan" } as unknown as ProtocolExecutionPlan;

function entry(id: string, roleId: string, text: string): MessageEntry {
  return {
    id,
    kind: "message.entry",
    role: { id: roleId, extensions: {} },
    content: [{ id: `${id}-text`, kind: "content.text", text, metadata: {}, extensions: {} }],
    relations: [],
    metadata: {},
    extensions: {},
  };
}

function messageDocument(children: MessageGroup["children"]): MessageDocument {
  return {
    version: "1.0",
    purpose: "input",
    root: {
      id: "message-root",
      kind: "message.root",
      composition: "container",
      children,
      relations: [],
      metadata: {},
      extensions: {},
    },
    metadata: {},
    extensions: {},
  };
}

function request(taskChildren: readonly object[], extra: Partial<ModelRequest> = {}): ModelRequest {
  return {
    target: {
      serviceId: "example",
      protocolId: "openai.chat.completions",
      model: { name: "model-name", metadata: {}, extensions: {} },
      extensions: {},
    },
    task: {
      descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
      document: {
        version: "1.0",
        root: {
          id: "task-root",
          kind: "task.root",
          composition: "container",
          children: taskChildren,
          relations: [],
          metadata: {},
          extensions: {},
        },
        metadata: {},
        extensions: {},
      },
      artifacts: { artifacts: [] },
      metadata: {},
      extensions: {},
    } as ModelRequest["task"],
    metadata: {},
    extensions: {},
    ...extra,
  };
}

it("builds a plain request object and does not encode, authorize, or send", () => {
  let credentialReads = 0;
  const authorization = {
    kind: "authorization.bearer",
    credentialSource: {
      getCredential(): never {
        credentialReads += 1;
        throw new Error("credential read");
      },
    },
  } as Authorization;
  const built = buildOpenAIChatCompletionRequest({
    request: request(
      [
        {
          id: "input",
          kind: "task.input.conversation",
          composition: "leaf",
          messages: messageDocument([
            entry("turn-1", "message.system", "guide"),
            entry("turn-2", "message.user", "hello"),
          ]),
          relations: [],
          metadata: {},
          extensions: {},
        },
        {
          id: "parameters",
          kind: "task.configuration",
          composition: "leaf",
          parameters: {
            temperature: 0,
            topP: 1,
            maxOutputTokens: 16,
            stop: ["END", "\n"],
            seed: -1,
          },
          relations: [],
          metadata: {},
          extensions: {},
        },
      ],
      {
        serviceAccess: {
          endpoint: { kind: "absolute", value: "https://example.test/v1" },
          authorization,
        },
      },
    ),
    plan,
  });

  expect(credentialReads).toBe(0);
  expect(built.diagnostics).toEqual([]);
  expect(built.value?.executionPlan).toBe(plan);
  expect(built.value?.payload.typeId).toBe("protocol.openai.chat-request");
  expect(built.value?.payload.value).toEqual({
    model: "model-name",
    messages: [
      { role: "system", content: "guide" },
      { role: "user", content: "hello" },
    ],
    temperature: 0,
    top_p: 1,
    max_tokens: 16,
    stop: ["END", "\n"],
    seed: -1,
    stream: false,
  });
  expect(typeof built.value?.payload.value).toBe("object");
  expect(built.value?.payload.value).not.toBeInstanceOf(Uint8Array);
});

it("rejects an out-of-range temperature without producing a payload", () => {
  const built = buildOpenAIChatCompletionRequest({
    request: request([
      {
        id: "input",
        kind: "task.input.conversation",
        composition: "leaf",
        messages: messageDocument([entry("turn-1", "message.user", "hello")]),
        relations: [],
        metadata: {},
        extensions: {},
      },
      {
        id: "parameters",
        kind: "task.configuration",
        composition: "leaf",
        parameters: { temperature: 3 },
        relations: [],
        metadata: {},
        extensions: {},
      },
    ]),
    plan,
  });

  expect(built.value).toBeUndefined();
  expect(built.diagnostics[0]?.code).toBe("temperature_out_of_range");
});

it("rejects artifacts and an unsupported task leaf", () => {
  const withArtifact = request([
    {
      id: "input",
      kind: "task.input.conversation",
      composition: "leaf",
      messages: messageDocument([entry("turn-1", "message.user", "hello")]),
      relations: [],
      metadata: {},
      extensions: {},
    },
  ]);
  withArtifact.task.artifacts.artifacts.push({} as never);
  expect(
    buildOpenAIChatCompletionRequest({ request: withArtifact, plan }).diagnostics[0]?.code,
  ).toBe("unsupported_message_content");

  const unknownLeaf = buildOpenAIChatCompletionRequest({
    request: request([
      {
        id: "other",
        kind: "task.tool",
        composition: "leaf",
        relations: [],
        metadata: {},
        extensions: {},
      },
    ]),
    plan,
  });
  expect(unknownLeaf.value).toBeUndefined();
  expect(unknownLeaf.diagnostics[0]?.code).toBe("unsupported_task_node");
});
