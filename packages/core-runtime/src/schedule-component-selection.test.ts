// Copyright © 2026 Mcont.

import type {
  ComponentDescriptor,
  PayloadDecoder,
  PayloadEncoder,
  RuntimeComponent,
  Transport,
} from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { scheduleComponentSelection } from "./schedule-component-selection.js";

function component(name: string, readable = true): RuntimeComponent {
  const descriptor: ComponentDescriptor = {
    name,
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
  };
  return {
    get descriptor(): ComponentDescriptor {
      if (!readable) {
        throw new Error(`descriptor of ${name} must not be read`);
      }
      return descriptor;
    },
  };
}

function candidates<Component extends RuntimeComponent>(
  selected: RuntimeComponent,
  tier: "interaction" | "client" | "integration" | "sdk",
): {
  readonly interactionComponent?: Component;
  readonly clientComponent?: Component;
  readonly integrationComponents: readonly Component[];
  readonly sdkDefaultComponent?: Component;
} {
  const hidden = component("hidden", false) as Component;
  const winner = selected as Component;
  if (tier === "interaction") {
    return {
      interactionComponent: winner,
      clientComponent: hidden,
      integrationComponents: [hidden, hidden],
      sdkDefaultComponent: hidden,
    };
  }
  if (tier === "client") {
    return {
      clientComponent: winner,
      integrationComponents: [hidden, hidden],
      sdkDefaultComponent: hidden,
    };
  }
  if (tier === "integration") {
    return {
      integrationComponents: [winner],
      sdkDefaultComponent: hidden,
    };
  }
  return { integrationComponents: [], sdkDefaultComponent: winner };
}

it("selects each role by interaction, client, integration, then SDK priority", () => {
  const encoder = component("interaction-encoder");
  const successDecoder = component("client-success-decoder");
  const errorDecoder = component("integration-error-decoder");
  const transport = component("sdk-transport");

  const resolution = scheduleComponentSelection({
    payloadEncoder: candidates<PayloadEncoder>(encoder, "interaction"),
    successPayloadDecoder: candidates<PayloadDecoder>(successDecoder, "client"),
    errorPayloadDecoder: candidates<PayloadDecoder>(errorDecoder, "integration"),
    transport: candidates<Transport>(transport, "sdk"),
  });

  expect(resolution.components.map((entry) => entry.component)).toEqual([
    encoder,
    successDecoder,
    errorDecoder,
    transport,
  ]);
  expect(resolution.components.map((entry) => entry.role.id)).toEqual([
    "codec.request.encoder",
    "codec.response.success-decoder",
    "codec.response.error-decoder",
    "transport.request",
  ]);
  expect(resolution.components[0]?.descriptor).toBe(encoder.descriptor);
  expect(Object.isFrozen(resolution)).toBe(true);
  expect(Object.isFrozen(resolution.components)).toBe(true);
});
