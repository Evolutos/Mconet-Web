// Copyright © 2026 Mcont.

import type { ModelRequest } from "@evolutos/mconet-core-domain";
import { expect, expectTypeOf, it } from "vitest";

import { createInteractionContext, type InteractionContext } from "./interaction-context.js";
import type { ModelClientConfigurationData } from "./model-client-configuration-data.js";

const request = { marker: "request" } as unknown as ModelRequest;

it("creates a fresh context and does not attach it to client configuration", () => {
  const signal = new AbortController().signal;
  const first = createInteractionContext({ request, options: { signal } });
  const second = createInteractionContext({ request });

  expect(first).not.toBe(second);
  expect(first.request).toBe(request);
  expect(first.options.signal).toBe(signal);
  expect(second.options).not.toHaveProperty("signal");
  expectTypeOf<ModelClientConfigurationData>().not.toMatchTypeOf<InteractionContext>();
});
