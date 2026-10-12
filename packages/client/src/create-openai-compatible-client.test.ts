// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { conversationRequest } from "./conversation-request.js";
import { createOpenAICompatibleClient } from "./create-openai-compatible-client.js";

it("composes the chat-completions adapter and does not send before the port check", async () => {
  let fetches = 0;
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    fetches += 1;
    return Promise.reject(new Error("fetch"));
  };
  const target = {
    serviceId: "service.vendor",
    protocolId: "openai.chat.completions",
    model: { name: "vendor-model", metadata: {}, extensions: {} },
    extensions: {},
  };
  const serviceAccess = {
    endpoint: { kind: "absolute" as const, value: "https://example.test/v1" },
    authorization: { kind: "authorization.none" },
    headers: [],
    query: [],
    extensions: {},
  };
  const client = createOpenAICompatibleClient({ target, serviceAccess });

  try {
    await expect(
      client.interact(
        conversationRequest({
          target,
          messages: [{ role: "user", text: "Hello" }],
          serviceAccess,
        }),
      ),
    ).rejects.toBeInstanceOf(ModelInteractionError);
    await expect(
      client.interact(
        conversationRequest({
          target,
          messages: [{ role: "user", text: "Hello" }],
          serviceAccess,
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid_component_type_contract" });
    expect(fetches).toBe(0);
  } finally {
    globalThis.fetch = original;
  }
});
