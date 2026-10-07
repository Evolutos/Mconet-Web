// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it, vi } from "vitest";

import type { Authorization } from "@evolutos/mconet-core-domain";
import type {
  AuthorizationContext,
  AuthorizationHandler,
  TransportRequest,
} from "@evolutos/mconet-core-spi";

import { StubAuthorizationHandler } from "./stub-authorization-handler.js";

/** Stable metadata shared by authorization handler fixtures. */
const descriptor: AuthorizationHandler["descriptor"] = {
  name: "stub-authorization-handler",
  version: "1.0.0",
  capabilities: new Set(),
  source: "application",
};

/** Open authorization description used by support and apply operations. */
const authorization: Authorization = { kind: "authorization.test" };

/** Encoded request supplied before authorization headers are applied. */
const request: TransportRequest = {
  method: "POST",
  url: { kind: "absolute", value: "https://service.example.test/run" },
  headers: [],
  query: [],
  body: { kind: "bytes", bytes: new Uint8Array([0x7b, 0x7d]) },
};

/** Non-sensitive context supplied to authorization application. */
const context: AuthorizationContext = {
  interactionId: "interaction-test",
  target: {
    serviceId: "service.test",
    protocolId: "protocol.test",
    model: { name: "model-test", metadata: {}, extensions: {} },
    extensions: {},
  },
  endpoint: { kind: "absolute", value: "https://service.example.test" },
  transportKind: "transport.http",
  timestamp: { epochMilliseconds: 2_000_000_000_000 },
  bodySigningMode: "none",
  signal: new AbortController().signal,
  extensions: {},
};

/** Distinct request returned by the configured apply handler. */
const authorizedRequest: TransportRequest = {
  ...request,
  headers: [{ name: "authorization", value: "REDACTED" }],
};

/** Complete immutable input bundle retained by application recording. */
const input = { request, authorization, context } as const;

it("delegates support inspection without recording an application", () => {
  const supports = vi.fn((value: Authorization) => value.kind === authorization.kind);
  const handler = new StubAuthorizationHandler({
    descriptor,
    supports,
    apply: () => Promise.resolve(authorizedRequest),
  });

  expect(handler.supports(authorization)).toBe(true);
  expect(handler.supports({ kind: "authorization.other" })).toBe(false);
  expect(supports).toHaveBeenNthCalledWith(1, authorization);
  expect(handler.snapshotApplications()).toEqual([]);
});

it("records the original apply input and preserves promise and result identities", async () => {
  const expectedPromise = Promise.resolve(authorizedRequest);
  const apply = vi.fn(() => expectedPromise);
  const handler = new StubAuthorizationHandler({ descriptor, supports: () => true, apply });

  const promise = handler.apply(input);

  expect(handler.descriptor).toBe(descriptor);
  expect(apply).toHaveBeenCalledExactlyOnceWith(input);
  expect(promise).toBe(expectedPromise);
  await expect(promise).resolves.toBe(authorizedRequest);
  expect(handler.snapshotApplications()[0]).toBe(input);
  expect(handler.snapshotApplications()[0]?.request).toBe(request);
  expect(handler.snapshotApplications()[0]?.authorization).toBe(authorization);
  expect(handler.snapshotApplications()[0]?.context).toBe(context);
  expect(request.headers).toEqual([]);
});

it("records a failed application and propagates the same rejection", async () => {
  const failure = new Error("authorization failed");
  const rejectedPromise = Promise.reject(failure);
  const handler = new StubAuthorizationHandler({
    descriptor,
    supports: () => true,
    apply: () => rejectedPromise,
  });

  const actual = handler.apply(input);
  expect(actual).toBe(rejectedPromise);
  await expect(actual).rejects.toBe(failure);
  expect(handler.snapshotApplications()).toEqual([input]);
});

it("returns frozen snapshots detached from later applications", async () => {
  const handler = new StubAuthorizationHandler({
    descriptor,
    supports: () => true,
    apply: () => Promise.resolve(authorizedRequest),
  });
  await handler.apply(input);
  const firstSnapshot = handler.snapshotApplications();

  const secondInput = { ...input, request: authorizedRequest };
  await handler.apply(secondInput);
  const secondSnapshot = handler.snapshotApplications();

  expect(firstSnapshot).toEqual([input]);
  expect(secondSnapshot).toEqual([input, secondInput]);
  expect(firstSnapshot).not.toBe(secondSnapshot);
  expect(Object.isFrozen(firstSnapshot)).toBe(true);
  expect(Reflect.set(firstSnapshot, 0, secondInput)).toBe(false);
});

it("implements only handler behavior plus read-only application observation", () => {
  expectTypeOf<StubAuthorizationHandler>().toMatchTypeOf<AuthorizationHandler>();
  expectTypeOf<StubAuthorizationHandler["supports"]>().toEqualTypeOf<
    AuthorizationHandler["supports"]
  >();
  expectTypeOf<StubAuthorizationHandler["apply"]>().toEqualTypeOf<AuthorizationHandler["apply"]>();
  expectTypeOf<StubAuthorizationHandler>().not.toHaveProperty("getCredential");
  expectTypeOf<StubAuthorizationHandler>().not.toHaveProperty("send");
  expectTypeOf<StubAuthorizationHandler>().not.toHaveProperty("applications");
  expectTypeOf<StubAuthorizationHandler>().not.toHaveProperty("reset");
});
