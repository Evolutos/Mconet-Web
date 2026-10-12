// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import type {
  ErasedRuntimeValue,
  TaskProtocolAdapter,
  TransportResponseMetadata,
} from "@evolutos/mconet-core-spi";
import { expect, it, vi } from "vitest";

import { scheduleParseError } from "./schedule-parse-error.js";

const payload: ErasedRuntimeValue = { typeId: "protocol.error", value: { code: "bad" } };
const metadata: TransportResponseMetadata = {
  outcome: "service_error",
  headers: [],
  extensions: {},
};

const classified = new ModelInteractionError({
  message: "The service rejected the request.",
  category: "model_service",
  phase: "response_parsing",
  code: "service_error",
  diagnostics: [],
});

function adapter(parseError: TaskProtocolAdapter["parseError"]): TaskProtocolAdapter {
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
    parseResponse: () => {
      throw new Error("parseResponse");
    },
    parseError,
  };
}

it("returns the adapter's service error", () => {
  const parseError = vi.fn(() => classified);

  expect(scheduleParseError({ adapter: adapter(parseError), payload, metadata })).toBe(classified);
  expect(parseError).toHaveBeenCalledOnce();
  expect(parseError).toHaveBeenCalledWith({ payload, metadata });
});

it("retains an unclassified throw as cause without copying its text", () => {
  const thrown = new Error("secret-service-text");
  const error = scheduleParseError({
    adapter: adapter(() => {
      throw thrown;
    }),
    payload,
    metadata,
  });

  expect(error.code).toBe("service_error_parsing_failed");
  expect(error.cause).toBe(thrown);
  expect(error.message).not.toMatch(/secret-service-text/u);
});
