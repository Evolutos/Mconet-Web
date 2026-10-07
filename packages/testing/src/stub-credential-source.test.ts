// Copyright © 2026 Mcont.

import { SecretValue } from "@evolutos/mconet-core-domain";
import { expect, expectTypeOf, it, vi } from "vitest";

import type { CredentialContext, CredentialSource } from "@evolutos/mconet-core-spi";

import { StubCredentialSource } from "./stub-credential-source.js";

/** Lifecycle context forwarded unchanged to credential providers. */
const context: CredentialContext = {
  signal: new AbortController().signal,
};

it("invokes the provider for every call and supports credential rotation", async () => {
  const firstCredential = new SecretValue("first-test-credential");
  const secondCredential = new SecretValue("second-test-credential");
  const firstPromise = Promise.resolve(firstCredential);
  const secondPromise = Promise.resolve(secondCredential);
  const getCredential = vi
    .fn<CredentialSource["getCredential"]>()
    .mockReturnValueOnce(firstPromise)
    .mockReturnValueOnce(secondPromise);
  const source = new StubCredentialSource(getCredential);

  const first = source.getCredential(context);
  const second = source.getCredential(context);

  // Each call reaches the provider, so rotation is provider-controlled rather
  // than hidden by accidental caching in the test double.
  expect(first).toBe(firstPromise);
  expect(second).toBe(secondPromise);
  await expect(first).resolves.toBe(firstCredential);
  await expect(second).resolves.toBe(secondCredential);
  expect(getCredential).toHaveBeenCalledTimes(2);
  expect(getCredential).toHaveBeenNthCalledWith(1, context);
  expect(getCredential).toHaveBeenNthCalledWith(2, context);
});

it("propagates a provider rejection unchanged", async () => {
  const failure = new Error("credential provider unavailable");
  const rejectedPromise = Promise.reject(failure);
  const source = new StubCredentialSource(() => rejectedPromise);

  // Provider failures remain available for phase-aware runtime normalization;
  // the stub neither retries nor substitutes a stale credential.
  const actual = source.getCredential(context);
  expect(actual).toBe(rejectedPromise);
  await expect(actual).rejects.toBe(failure);
});

it("supports handler-controlled cancellation observation", async () => {
  const controller = new AbortController();
  const cancellationContext: CredentialContext = { signal: controller.signal };
  const failure = new Error("credential resolution cancelled");
  const source = new StubCredentialSource(
    (suppliedContext) =>
      new Promise((_resolve, reject) => {
        // Cancellation remains provider-owned while the stub preserves the exact
        // composed interaction signal in the minimal CredentialContext.
        suppliedContext.signal.addEventListener("abort", () => reject(failure), { once: true });
      }),
  );

  const promise = source.getCredential(cancellationContext);
  controller.abort();

  await expect(promise).rejects.toBe(failure);
});

it("captures the handler reference at construction", async () => {
  const credential = new SecretValue("stable-test-credential");
  const originalHandler = vi.fn(() => Promise.resolve(credential));
  let handler: CredentialSource["getCredential"] = originalHandler;
  const source = new StubCredentialSource(handler);
  handler = () => Promise.reject(new Error("replacement"));

  // Reassigning the external variable cannot replace the private handler stored
  // by an existing source instance.
  await expect(source.getCredential(context)).resolves.toBe(credential);
  expect(originalHandler).toHaveBeenCalledExactlyOnceWith(context);
  expect(handler).not.toBe(originalHandler);
});

it("implements only the credential source boundary", () => {
  // Compile-time checks preserve protected asynchronous output and exclude
  // plaintext access, caches, recording, retry, and reset controls.
  expectTypeOf<StubCredentialSource>().toMatchTypeOf<CredentialSource>();
  expectTypeOf<StubCredentialSource["getCredential"]>().toEqualTypeOf<
    CredentialSource["getCredential"]
  >();
  expectTypeOf<StubCredentialSource>().not.toHaveProperty("credential");
  expectTypeOf<StubCredentialSource>().not.toHaveProperty("snapshotCalls");
  expectTypeOf<StubCredentialSource>().not.toHaveProperty("retry");
  expectTypeOf<StubCredentialSource>().not.toHaveProperty("reset");
});
