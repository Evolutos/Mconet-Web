// Copyright © 2026 Mcont.

import type { ErasedRuntimeValue, PayloadDecoder } from "@evolutos/mconet-core-spi";
import { expect, it, vi } from "vitest";

import { scheduleDecodePayload } from "./schedule-decode-payload.js";

const bytes = new Uint8Array([1, 2]);
const context = { signal: new AbortController().signal };
const decoded: ErasedRuntimeValue = { typeId: "protocol.response", value: { ok: true } };

function decoder(decode: PayloadDecoder["decode"]): PayloadDecoder {
  return {
    descriptor: {
      name: "decoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    decode,
  };
}

it("returns one decoded value", async () => {
  const decode = vi.fn(async () => decoded);
  const result = await scheduleDecodePayload({ decoder: decoder(decode), bytes, context });

  expect(result.value).toBe(decoded);
  expect(decode).toHaveBeenCalledOnce();
  expect(decode).toHaveBeenCalledWith(bytes, context);
});

it("normalizes a decoding rejection without copying its message", async () => {
  const decode = vi.fn(async (): Promise<ErasedRuntimeValue> => {
    throw new Error("secret-body");
  });
  const result = await scheduleDecodePayload({ decoder: decoder(decode), bytes, context });

  expect(result.value).toBeUndefined();
  expect(result.diagnostics[0]?.code).toBe("decoding_failed");
  expect(result.diagnostics[0]?.phase).toBe("decoding");
  expect(result.diagnostics[0]?.message).not.toMatch(/secret-body/u);
});
