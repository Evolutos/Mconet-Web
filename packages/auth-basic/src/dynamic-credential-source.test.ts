// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { ModelInteractionError, SecretValue } from "@evolutos/mconet-core-domain";
import type { CredentialContext } from "@evolutos/mconet-core-spi";

import { DynamicCredentialSource } from "./dynamic-credential-source.js";

const firstPlaintext = "dynamic-credential-one";
const secondPlaintext = "dynamic-credential-two";

it("reads a new SecretValue on every resolution", async () => {
  const secrets = [new SecretValue(firstPlaintext), new SecretValue(secondPlaintext)];
  const contexts: CredentialContext[] = [];
  const signal = new AbortController().signal;
  let reads = 0;
  const source = new DynamicCredentialSource((context) => {
    reads += 1;
    contexts.push(context);
    const secret = secrets[reads - 1];
    if (secret === undefined) {
      throw new Error("unexpected extra read");
    }
    return secret;
  });

  const first = await source.getCredential({ signal });
  const second = await source.getCredential({ signal });

  // Each attempt receives the original context and the credential produced by
  // that attempt. The first wrapper is not reused for the second call.
  expect(reads).toBe(2);
  expect(contexts).toEqual([{ signal }, { signal }]);
  expect(first).toBe(secrets[0]);
  expect(second).toBe(secrets[1]);
  expect(first.expose((value) => value)).toBe(firstPlaintext);
  expect(second.expose((value) => value)).toBe(secondPlaintext);
});

it("does not read when the interaction is already cancelled", async () => {
  let reads = 0;
  const source = new DynamicCredentialSource(() => {
    reads += 1;
    return new SecretValue(firstPlaintext);
  });

  await expect(source.getCredential({ signal: AbortSignal.abort() })).rejects.toBeInstanceOf(
    ModelInteractionError,
  );
  expect(reads).toBe(0);
});

it("drops a credential read that finishes after cancellation", async () => {
  const secret = new SecretValue(firstPlaintext);
  const controller = new AbortController();
  const source = new DynamicCredentialSource(() => {
    controller.abort();
    return secret;
  });

  await expect(source.getCredential({ signal: controller.signal })).rejects.toEqual(
    new ModelInteractionError({
      message: "Credential resolution was cancelled.",
      category: "cancelled",
      phase: "authorization",
      code: "cancelled",
      diagnostics: [],
    }),
  );
  expect(String(secret)).not.toContain(firstPlaintext);
});

it("rejects a reader result that is not a SecretValue without echoing it", async () => {
  const source = new DynamicCredentialSource(() => firstPlaintext as unknown as SecretValue);

  await expect(source.getCredential({ signal: new AbortController().signal })).rejects.toThrow(
    new TypeError("credential must be a SecretValue."),
  );
});

it("propagates a reader failure without replacing it", async () => {
  const failure = new Error("credential provider failed");
  const source = new DynamicCredentialSource(() => {
    throw failure;
  });

  await expect(source.getCredential({ signal: new AbortController().signal })).rejects.toBe(
    failure,
  );
});

it("rejects a missing reader", () => {
  expect(() => new DynamicCredentialSource(undefined as unknown as () => SecretValue)).toThrow(
    new TypeError("read must be a function."),
  );
});
