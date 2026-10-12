// Copyright © 2026 Mcont.

import type { ParsedTaskResponse, ProcessingResult } from "@evolutos/mconet-core-domain";
import type {
  ErasedRuntimeValue,
  TaskProtocolAdapter,
  TransportResponseMetadata,
} from "@evolutos/mconet-core-spi";
import { expect, it, vi } from "vitest";

import { scheduleParseResponse } from "./schedule-parse-response.js";

const payload: ErasedRuntimeValue = { typeId: "protocol.response", value: { ok: true } };
const metadata: TransportResponseMetadata = {
  outcome: "success",
  headers: [],
  extensions: {},
};
const parsed = { result: { messages: [] } } as unknown as ParsedTaskResponse;

function adapter(parseResponse: TaskProtocolAdapter["parseResponse"]): TaskProtocolAdapter {
  return {
    descriptor: {
      name: "adapter",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    supports: () => {
      throw new Error("supports");
    },
    preparePlan: () => {
      throw new Error("preparePlan");
    },
    buildRequest: () => {
      throw new Error("buildRequest");
    },
    parseResponse,
    parseError: () => {
      throw new Error("parseError");
    },
  };
}

it("returns one parsed success result", () => {
  const parseResponse = vi.fn((): ProcessingResult<ParsedTaskResponse> => ({
    value: parsed,
    diagnostics: [],
  }));
  const result = scheduleParseResponse({
    adapter: adapter(parseResponse),
    payload,
    metadata,
  });

  expect(result.value).toBe(parsed);
  expect(parseResponse).toHaveBeenCalledOnce();
  expect(parseResponse).toHaveBeenCalledWith({ payload, metadata });
});

it("normalizes a thrown parser without copying its message", () => {
  const parseResponse = vi.fn((): ProcessingResult<ParsedTaskResponse> => {
    throw new Error("secret-response");
  });
  const result = scheduleParseResponse({
    adapter: adapter(parseResponse),
    payload,
    metadata,
  });

  expect(result.value).toBeUndefined();
  expect(result.diagnostics[0]?.code).toBe("response_parsing_failed");
  expect(result.diagnostics[0]?.message).not.toMatch(/secret-response/u);
});
