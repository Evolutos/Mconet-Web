// Copyright © 2026 Mcont.

import { isModelRequest, type ModelRequest, type ModelTarget } from "@evolutos/mconet-core-domain";
import { expect, expectTypeOf, it } from "vitest";

import { conversationRequest, type ConversationRequestInput } from "./conversation-request.js";

it("returns only a model request for the text turns", () => {
  const target = createTarget();
  const input: ConversationRequestInput = {
    target,
    messages: [
      { role: "system", text: "Be brief" },
      { role: "user", text: "Hello" },
    ],
  };
  const request = conversationRequest(input);

  expectTypeOf(conversationRequest).returns.toEqualTypeOf<ModelRequest>();
  expect(isModelRequest(request)).toBe(true);
  expect(request.target).toBe(target);
  expect(request.serviceAccess).toBeUndefined();
  expect(request.task.descriptor.type).toBe("conversation.generate");
  expect(JSON.stringify(request)).toContain("message.system");
  expect(JSON.stringify(request)).toContain("message.user");
  expect(JSON.stringify(request)).toContain("Hello");
  expect(request).not.toHaveProperty("interact");
});

function createTarget(): ModelTarget {
  return {
    serviceId: "service.vendor",
    protocolId: "protocol.vendor",
    model: { name: "vendor-model", metadata: {}, extensions: {} },
    extensions: {},
  };
}
