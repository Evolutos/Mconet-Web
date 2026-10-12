// Copyright © 2026 Mcont.

import type { ErasedRuntimeValue, PayloadEncoder, TransportBody } from "@evolutos/mconet-core-spi";
import { expect, it, vi } from "vitest";

import { scheduleEncodePayload } from "./schedule-encode-payload.js";

const payload: ErasedRuntimeValue = { typeId: "protocol.request", value: { secret: "hidden" } };
const context = { signal: new AbortController().signal };
const body: TransportBody = { kind: "bytes", bytes: new Uint8Array([1, 2, 3]) };

function encoder(encode: PayloadEncoder["encode"]): PayloadEncoder {
  return {
    descriptor: {
      name: "encoder",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    encode,
  };
}

it("returns the encoded body from one encoder call", async () => {
  const encode = vi.fn(async (): Promise<TransportBody> => body);
  const result = await scheduleEncodePayload({
    encoder: encoder(encode),
    payload,
    context,
  });

  expect(result.value).toBe(body);
  expect(encode).toHaveBeenCalledOnce();
  expect(encode).toHaveBeenCalledWith(payload, context);
});

it("returns an encoding failure and does not expose the encoder message", async () => {
  const encode = vi.fn(async (): Promise<TransportBody> => {
    throw new Error("secret payload text");
  });
  const result = await scheduleEncodePayload({
    encoder: encoder(encode),
    payload,
    context,
  });

  expect(result.value).toBeUndefined();
  expect(result.diagnostics[0]?.code).toBe("encoding_failed");
  expect(result.diagnostics[0]?.phase).toBe("encoding");
  expect(result.diagnostics[0]?.message).not.toMatch(/secret/u);
  expect(encode).toHaveBeenCalledOnce();
});
