// Copyright © 2026 Mcont.

import { SecretValue } from "@evolutos/mconet-core-domain";
import { expect, expectTypeOf, it } from "vitest";

import type { CredentialContext } from "./credential-context.js";
import type { CredentialSource } from "./credential-source.js";

it("defines the exact asynchronous credential source contract", () => {
  // Exact equality prevents context removal, synchronous return values, or a
  // plaintext credential type from weakening the public provider boundary.
  expectTypeOf<CredentialSource>().toEqualTypeOf<{
    getCredential(context: CredentialContext): Promise<SecretValue>;
  }>();
});

it("supports resolving a protected value for each invocation", async () => {
  const credential = new SecretValue("test-credential");
  const controller = new AbortController();
  let invocationCount = 0;
  const source: CredentialSource = {
    async getCredential(context) {
      // Observe the supplied lifecycle boundary and count the provider call;
      // returning the same fixture here does not imply SDK-side caching.
      expect(context.signal).toBe(controller.signal);
      invocationCount += 1;
      return credential;
    },
  };

  // Invoke the source twice to prove that the contract remains callable per
  // interaction instead of exposing a credential property captured at startup.
  const context: CredentialContext = { signal: controller.signal };
  await expect(source.getCredential(context)).resolves.toBe(credential);
  await expect(source.getCredential(context)).resolves.toBe(credential);
  expect(invocationCount).toBe(2);
});

it("allows provider failures to reject the returned promise unchanged", async () => {
  const providerFailure = new Error("credential provider unavailable");
  const source: CredentialSource = {
    getCredential() {
      // The SPI does not hide provider failures or invent retry behavior; error
      // normalization belongs to the later runtime authorization boundary.
      return Promise.reject(providerFailure);
    },
  };

  // Identity comparison proves this interface layer adds no implicit wrapping.
  const context: CredentialContext = { signal: new AbortController().signal };
  await expect(source.getCredential(context)).rejects.toBe(providerFailure);
});

it("rejects synchronous and plaintext credential providers at compile time", () => {
  // Both negative shapes intentionally violate the Promise<SecretValue> result,
  // protecting asynchronous refresh and secret redaction requirements.
  expectTypeOf<{
    getCredential(context: CredentialContext): SecretValue;
  }>().not.toMatchTypeOf<CredentialSource>();
  expectTypeOf<{
    getCredential(context: CredentialContext): Promise<string>;
  }>().not.toMatchTypeOf<CredentialSource>();
});
