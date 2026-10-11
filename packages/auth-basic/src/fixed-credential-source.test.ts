// Copyright © 2026 Mcont.

import { inspect } from "node:util";

import { expect, it } from "vitest";

import { ModelInteractionError, SecretValue } from "@evolutos/mconet-core-domain";

import { FixedCredentialSource } from "./fixed-credential-source.js";

const plaintext = "fixed-credential-value";

it("returns the retained SecretValue without copying or exposing it", async () => {
  const secret = new SecretValue(plaintext);
  const source = new FixedCredentialSource(secret);
  const first = await source.getCredential({ signal: new AbortController().signal });
  const second = await source.getCredential({ signal: new AbortController().signal });

  // The source keeps the caller's wrapper. Repeated reads do not allocate
  // another secret or require the plaintext to be read again.
  expect(first).toBe(secret);
  expect(second).toBe(secret);
  expect(first.expose((value) => value)).toBe(plaintext);
});

it("keeps the fixed credential out of properties, text, and inspection", () => {
  const source = new FixedCredentialSource(new SecretValue(plaintext));

  expect(Object.keys(source)).toEqual([]);
  expect(Object.getOwnPropertyNames(source)).toEqual([]);
  expect(JSON.stringify(source)).not.toContain(plaintext);
  expect(String(source)).not.toContain(plaintext);
  expect(inspect(source)).not.toContain(plaintext);
  expect(inspect(source, { showHidden: true })).not.toContain(plaintext);
});

it("rejects credential resolution when the interaction is already cancelled", async () => {
  const source = new FixedCredentialSource(new SecretValue(plaintext));
  const signal = AbortSignal.abort();

  await expect(source.getCredential({ signal })).rejects.toEqual(
    new ModelInteractionError({
      message: "Credential resolution was cancelled.",
      category: "cancelled",
      phase: "authorization",
      code: "cancelled",
      diagnostics: [],
    }),
  );

  try {
    await source.getCredential({ signal });
  } catch (error) {
    expect(error).toBeInstanceOf(ModelInteractionError);
    expect(String(error)).not.toContain(plaintext);
    expect(JSON.stringify(error)).not.toContain(plaintext);
  }
});

it("rejects a credential that is not already protected by SecretValue", () => {
  expect(() => new FixedCredentialSource(plaintext as unknown as SecretValue)).toThrow(
    new TypeError("secret must be a SecretValue."),
  );
});
