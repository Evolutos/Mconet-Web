// Copyright © 2026 Mcont.

import type { ResolvedInteractionResourceLimits } from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import type { ResolvedInteractionConfiguration } from "./resolved-interaction-configuration.js";
import { resolveInteractionSignal } from "./resolve-interaction-signal.js";

const limits: ResolvedInteractionResourceLimits = {
  maxResponseBodyBytes: 1,
  maxStreamingErrorBodyBytes: 1,
  maxFrameBytes: 1,
};

function configuration(signal?: AbortSignal): ResolvedInteractionConfiguration {
  return {
    target: {
      serviceId: "service.request",
      protocolId: "protocol.request",
      model: { name: "request-model", metadata: {}, extensions: {} },
      extensions: {},
    },
    serviceAccess: undefined,
    compatibilityPolicy: { mode: "compatible" },
    resourceLimits: limits,
    ...(signal === undefined ? { signal: undefined } : { signal }),
  };
}

it("propagates caller cancellation onto a distinct signal", () => {
  const caller = new AbortController();
  const reason = new Error("caller cancelled");
  const resolved = resolveInteractionSignal(configuration(caller.signal));

  expect(resolved).not.toBe(caller.signal);
  expect(resolved.aborted).toBe(false);
  caller.abort(reason);
  expect(resolved.aborted).toBe(true);
  expect(resolved.reason).toBe(reason);
});

it("leaves the interaction signal open when the caller supplied none", () => {
  const resolved = resolveInteractionSignal(configuration());

  expect(resolved.aborted).toBe(false);
});
