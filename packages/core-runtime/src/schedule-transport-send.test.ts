// Copyright © 2026 Mcont.

import type { ResolvedInteractionResourceLimits } from "@evolutos/mconet-core-domain";
import type { Transport, TransportRequest, TransportResponse } from "@evolutos/mconet-core-spi";
import { expect, it, vi } from "vitest";

import { scheduleTransportSend } from "./schedule-transport-send.js";

const signal = new AbortController().signal;
const deadline = 1_700_000_000_000;
const resourceLimits: ResolvedInteractionResourceLimits = {
  maxResponseBodyBytes: 1024,
  maxStreamingErrorBodyBytes: 256,
  maxFrameBytes: 128,
};
const request: TransportRequest = {
  method: "POST",
  url: { kind: "absolute", value: "https://example.test/v1" },
  headers: [],
  query: [],
  body: { kind: "bytes", bytes: new Uint8Array([1]) },
};
const response: TransportResponse = {
  metadata: { outcome: "success", headers: [], extensions: {} },
  body: new Uint8Array([2]),
};

function transport(send: Transport["send"]): Transport {
  return {
    descriptor: {
      name: "transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    send,
  };
}

it("sends once with the signal, deadline, and response limit", async () => {
  const send = vi.fn(async () => response);
  const result = await scheduleTransportSend({
    transport: transport(send),
    request,
    signal,
    deadline,
    resourceLimits,
  });

  expect(result.value).toBe(response);
  expect(send).toHaveBeenCalledOnce();
  expect(send).toHaveBeenCalledWith(request, {
    signal,
    deadline,
    maxResponseBodyBytes: 1024,
  });
});

it("returns a transport failure without copying the thrown text", async () => {
  const send = vi.fn(async () => {
    throw new Error("network-secret");
  });
  const result = await scheduleTransportSend({
    transport: transport(send),
    request,
    signal,
    resourceLimits,
  });

  expect(result.value).toBeUndefined();
  expect(result.diagnostics[0]?.code).toBe("transport_failed");
  expect(result.diagnostics[0]?.phase).toBe("transport");
  expect(result.diagnostics[0]?.message).not.toMatch(/network-secret/u);
  expect(send).toHaveBeenCalledWith(request, {
    signal,
    maxResponseBodyBytes: 1024,
  });
});
