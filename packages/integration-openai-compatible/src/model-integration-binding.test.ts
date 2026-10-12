// Copyright © 2026 Mcont.

import type { Authorization } from "@evolutos/mconet-core-domain";
import type { RuntimeComponent } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { createIntegrationTypeKey } from "./integration-type-key.js";
import { createModelIntegrationBinding } from "./model-integration-binding.js";
import * as bindingModule from "./model-integration-binding.js";

const adapter: RuntimeComponent = {
  descriptor: {
    name: "chat-adapter",
    version: "1.0.0",
    capabilities: new Set(),
    source: "plugin",
  },
};

it("composes one binding without registering it or reading a credential", () => {
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
  const handlers = [adapter];
  const binding = createModelIntegrationBinding({
    key: createIntegrationTypeKey({
      protocolId: "openai.chat.completions",
      taskType: "conversation.generate",
      modeId: "unary",
    }),
    bindingId: "binding.openai.chat",
    bindingVersion: "1.0.0",
    taskProtocolAdapter: adapter,
    authorizationHandlers: handlers,
    payloadEncoders: [],
    payloadDecoders: [],
    transports: [],
    defaultServiceAccess: {
      endpoint: { kind: "absolute", value: "https://example.test/v1" },
      authorization,
    },
  });
  handlers.push(adapter);

  expect(credentialReads).toBe(0);
  expect(binding.authorizationHandlers).toHaveLength(1);
  expect(binding.key).toEqual({
    protocolId: "openai.chat.completions",
    taskType: "conversation.generate",
    modeId: "unary",
  });
  expect(binding).not.toHaveProperty("model");
  expect(Object.keys(bindingModule).sort()).toEqual(["createModelIntegrationBinding"]);
  expect(createModelIntegrationBinding).not.toHaveProperty("registry");
});
