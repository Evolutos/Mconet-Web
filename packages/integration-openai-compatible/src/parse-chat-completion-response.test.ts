// Copyright © 2026 Mcont.

import { isParsedTaskResponse } from "@evolutos/mconet-core-domain";
import type { ErasedRuntimeValue, TransportResponseMetadata } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { parseOpenAIChatCompletionResponse } from "./parse-chat-completion-response.js";

const metadata: TransportResponseMetadata = {
  outcome: "success",
  statusCode: 200,
  headers: [],
  extensions: {},
};

function payload(value: unknown): ErasedRuntimeValue {
  return { typeId: "protocol.openai.chat-response", value };
}

it("parses a success body without assembling a model output", () => {
  const parsed = parseOpenAIChatCompletionResponse({
    payload: payload({
      id: "resp-1",
      model: "service-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "hello" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 2, total_tokens: 2 },
      system_fingerprint: "fp",
    }),
    metadata,
  });

  expect(parsed.diagnostics).toEqual([]);
  expect(isParsedTaskResponse(parsed.value)).toBe(true);
  expect(parsed.value).not.toHaveProperty("target");
  expect(parsed.value).not.toHaveProperty("diagnostics");
  expect(parsed.value?.status).toBe("completed");
  expect(parsed.value?.stopReason).toBe("stop");
  expect(parsed.value?.resolvedModel).toEqual({
    name: "service-model",
    metadata: {},
    extensions: {},
  });
  expect(parsed.value?.usage).toEqual({
    inputTokens: 0,
    outputTokens: 2,
    totalTokens: 2,
    extensions: {},
  });
  expect(parsed.value?.extensions).toEqual({ system_fingerprint: "fp" });
  expect(parsed.value?.protocolState).toEqual([]);
  const messages = parsed.value?.result as {
    messages?: { root: { children: { content: { text: string }[] }[] } };
  };
  expect(messages.messages?.root.children[0]?.content[0]?.text).toBe("hello");
});

it("keeps an omitted model and usage omitted", () => {
  const parsed = parseOpenAIChatCompletionResponse({
    payload: payload({
      choices: [
        {
          index: 1,
          message: { role: "assistant", content: "only" },
          finish_reason: "length",
        },
      ],
    }),
    metadata,
  });

  expect(parsed.value?.status).toBe("incomplete");
  expect(parsed.value?.stopReason).toBe("length");
  expect(parsed.value === undefined || Object.hasOwn(parsed.value, "resolvedModel")).toBe(false);
  expect(parsed.value === undefined || Object.hasOwn(parsed.value, "usage")).toBe(false);
});

it("preserves an unrecognized finish reason and does not rename it", () => {
  const parsed = parseOpenAIChatCompletionResponse({
    payload: payload({
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "held" },
          finish_reason: "provider.custom",
        },
      ],
    }),
    metadata,
  });

  expect(parsed.value?.status).toBe("unknown");
  expect(parsed.value?.stopReason).toBe("provider.custom");
});

it("accepts several choices that share one finish reason", () => {
  const parsed = parseOpenAIChatCompletionResponse({
    payload: payload({
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "a" },
          finish_reason: "content_filter",
        },
        {
          index: 1,
          message: { role: "assistant", content: "b" },
          finish_reason: "content_filter",
        },
      ],
    }),
    metadata,
  });

  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.value?.status).toBe("filtered");
  expect(parsed.value?.stopReason).toBe("content_filter");
  const children = (
    parsed.value?.result as { messages?: { root: { children: readonly unknown[] } } }
  ).messages?.root.children;
  expect(children).toHaveLength(2);
});

it("maps tool and function finish reasons to requires_action", () => {
  for (const reason of ["tool_calls", "function_call"]) {
    const parsed = parseOpenAIChatCompletionResponse({
      payload: payload({
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "" },
            finish_reason: reason,
          },
        ],
      }),
      metadata,
    });
    expect(parsed.value?.status).toBe("requires_action");
    expect(parsed.value?.stopReason).toBe(reason);
  }
});

it("rejects choices that disagree on the finish reason", () => {
  const parsed = parseOpenAIChatCompletionResponse({
    payload: payload({
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "a" },
          finish_reason: "stop",
        },
        {
          index: 1,
          message: { role: "assistant", content: "b" },
          finish_reason: "length",
        },
      ],
    }),
    metadata,
  });

  expect(parsed.value).toBeUndefined();
  expect(parsed.diagnostics[0]?.code).toBe("ambiguous_finish_reason");
});

it("rejects an empty choice list, a foreign type, and a non-success outcome", () => {
  const empty = parseOpenAIChatCompletionResponse({
    payload: payload({ choices: [] }),
    metadata,
  });
  expect(empty.value).toBeUndefined();
  expect(empty.diagnostics[0]?.code).toBe("empty_choices");

  const foreign = parseOpenAIChatCompletionResponse({
    payload: { typeId: "protocol.other", value: { choices: [] } },
    metadata,
  });
  expect(foreign.diagnostics[0]?.code).toBe("invalid_response_type");

  const errorOutcome = parseOpenAIChatCompletionResponse({
    payload: payload({
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "hidden" },
          finish_reason: "stop",
        },
      ],
    }),
    metadata: { outcome: "service_error", headers: [], extensions: {} },
  });
  expect(errorOutcome.value).toBeUndefined();
  expect(errorOutcome.diagnostics[0]?.code).toBe("unexpected_transport_outcome");
});
