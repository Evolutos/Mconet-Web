// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  type ResolvedServiceAccess,
  type ServiceAccess,
} from "@evolutos/mconet-core-domain";
import type { ServiceAccessResolver } from "@evolutos/mconet-core-spi";
import { expect, it, vi } from "vitest";

import { scheduleServiceAccessResolution } from "./schedule-service-access-resolution.js";

const endpoint = {
  kind: "absolute",
  value: "https://service.example.test/v1",
} as const;

function access(partial: Partial<ServiceAccess> = {}): ServiceAccess {
  return {
    headers: [],
    query: [],
    extensions: {},
    ...partial,
  };
}

it("fails stably when every access layer is absent", () => {
  const error = captureInteractionError(() => {
    scheduleServiceAccessResolution({});
  });

  expect(error.code).toBe("service_access_incomplete");
  expect(error.phase).toBe("resolution");
  expect(error.message).not.toMatch(/https?:/u);
});

it("calls an injected resolver once and keeps its snapshot", () => {
  const resolved = Object.freeze({
    endpoint,
    authorization: { kind: "authorization.none" },
    headers: [],
    query: [],
    extensions: {},
  }) as ResolvedServiceAccess;
  const resolve = vi.fn((): ResolvedServiceAccess => resolved);
  const resolver = {
    descriptor: {
      name: "access-resolver",
      version: "1.0.0",
      capabilities: new Set(),
      source: "application",
    },
    resolve,
  } as ServiceAccessResolver;
  const requestAccess = access({
    endpoint,
    authorization: { kind: "authorization.none" },
  });

  expect(scheduleServiceAccessResolution({ resolver, requestAccess })).toBe(resolved);
  expect(resolve).toHaveBeenCalledOnce();
  expect(resolve).toHaveBeenCalledWith({ requestAccess });
});

it("uses the builtin resolver without guessing an endpoint", () => {
  const integrationDefault = access({
    endpoint,
    authorization: { kind: "authorization.none" },
  });

  expect(scheduleServiceAccessResolution({ integrationDefault }).endpoint).toEqual(endpoint);
});

function captureInteractionError(action: () => void): ModelInteractionError {
  try {
    action();
  } catch (caught) {
    if (caught instanceof ModelInteractionError) {
      return caught;
    }
    throw caught;
  }
  throw new Error("Expected a model interaction error.");
}
