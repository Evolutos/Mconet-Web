// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { createOpenAIChatServerStreamReader } from "./openai-chat-server-stream-reader.js";
import { OPENAI_CHAT_RESPONSE_TYPE_ID } from "./prepare-chat-completion-plan.js";

it("joins split SSE frames into one chat completion and reports each fragment", async () => {
  const reader = createOpenAIChatServerStreamReader();
  const encoder = new TextEncoder();
  const frames = [
    encoder.encode('data: {"id":"r1","model":"qwen","choices":[{"index":0,"delta":{"content":"你"}}]}\n'),
    encoder.encode('data: {"choices":[{"index":0,"delta":{"content":"好"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n'),
  ];
  const fragments: string[] = [];
  const payload = await reader.read({
    frames: (async function* yieldFrames() {
      yield frames[0] ?? new Uint8Array();
      yield frames[1] ?? new Uint8Array();
    })(),
    signal: new AbortController().signal,
    maxBodyBytes: 10_000,
    maxFrameBytes: 10_000,
    onText(text) {
      fragments.push(text);
    },
  });

  expect(fragments).toEqual(["你", "好"]);
  expect(payload.typeId).toBe(OPENAI_CHAT_RESPONSE_TYPE_ID);
  expect(payload.value).toMatchObject({
    id: "r1",
    model: "qwen",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "你好" },
        finish_reason: "stop",
      },
    ],
  });
});
