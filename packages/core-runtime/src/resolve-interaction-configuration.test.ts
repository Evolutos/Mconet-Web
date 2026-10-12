// Copyright © 2026 Mcont.

import type {
  ModelRequest,
  ModelTarget,
  ResolvedInteractionResourceLimits,
} from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { createInteractionContext } from "./interaction-context.js";
import type { ModelClientConfigurationData } from "./model-client-configuration-data.js";
import { resolveInteractionConfiguration } from "./resolve-interaction-configuration.js";

const requestTarget: ModelTarget = {
  serviceId: "service.request",
  protocolId: "protocol.request",
  model: { name: "request-model", metadata: {}, extensions: {} },
  extensions: {},
};

const clientTarget: ModelTarget = {
  serviceId: "service.client",
  protocolId: "protocol.client",
  model: { name: "client-model", metadata: {}, extensions: {} },
  extensions: {},
};

const sdkResourceLimits: ResolvedInteractionResourceLimits = {
  maxResponseBodyBytes: 100,
  maxStreamingErrorBodyBytes: 200,
  maxFrameBytes: 300,
};

it("keeps a one-request policy off the client configuration", () => {
  const clientConfiguration: ModelClientConfigurationData = { defaultTarget: clientTarget };
  const before = { ...clientConfiguration };
  const signal = new AbortController().signal;
  const resolved = resolveInteractionConfiguration({
    context: createInteractionContext({
      request: { target: requestTarget, metadata: {}, extensions: {} } as ModelRequest,
      options: { compatibilityPolicy: { mode: "strict" }, signal },
    }),
    clientConfiguration,
    sdkResourceLimits,
  });

  expect(resolved.target).toBe(requestTarget);
  expect(resolved.compatibilityPolicy).toEqual({ mode: "strict" });
  expect(resolved.signal).toBe(signal);
  expect(clientConfiguration).toEqual(before);
  expect(clientConfiguration).not.toHaveProperty("defaultCompatibilityPolicy");
  expect(clientConfiguration.defaultTarget).toBe(clientTarget);
});
