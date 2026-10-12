// Copyright © 2026 Mcont.

import { SecretValue } from "@evolutos/mconet-core-domain";
import type { CredentialSource, Transport } from "@evolutos/mconet-core-spi";
import { expect, it, vi } from "vitest";

import { scheduleCredentialRead } from "./schedule-credential-read.js";

const signal = new AbortController().signal;
const secret = new SecretValue("credential-secret");

function transport(): Transport {
  return {
    descriptor: {
      name: "transport",
      version: "1.0.0",
      capabilities: new Set(),
      source: "builtin",
    },
    send: vi.fn(() => {
      throw new Error("send");
    }),
  };
}

it("returns one secret and does not send", async () => {
  const idle = transport();
  const getCredential = vi.fn(async () => secret);
  const source: CredentialSource = { getCredential };
  const result = await scheduleCredentialRead({
    credentialSource: source,
    signal,
    transport: idle,
  });

  expect(result.value).toBe(secret);
  expect(getCredential).toHaveBeenCalledOnce();
  expect(getCredential).toHaveBeenCalledWith({ signal });
  expect(idle.send).not.toHaveBeenCalled();
});

it("returns a credential failure without sending or copying the source message", async () => {
  const idle = transport();
  const source: CredentialSource = {
    async getCredential() {
      throw new Error("credential-secret-text");
    },
  };
  const result = await scheduleCredentialRead({
    credentialSource: source,
    signal,
    transport: idle,
  });

  expect(result.value).toBeUndefined();
  expect(result.diagnostics[0]?.code).toBe("credential_read_failed");
  expect(result.diagnostics[0]?.message).not.toMatch(/credential-secret-text/u);
  expect(idle.send).not.toHaveBeenCalled();
});
