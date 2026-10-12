// Copyright © 2026 Mcont.

import type { InteractionMode, MediaType } from "@evolutos/mconet-core-domain";
import type { ProtocolExecutionPlan } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { validateR1PlanScope } from "./validate-r1-plan-scope.js";

const json: MediaType = { type: "application", subtype: "json", parameters: {} };
const mode: InteractionMode = { id: "unary" };

function plan(
  patch: {
    readonly method?: string;
    readonly endpoint?: string;
    readonly transportKind?: string;
    readonly mediaType?: MediaType;
  } = {},
): ProtocolExecutionPlan {
  const mediaType = patch.mediaType ?? json;
  return {
    transportPlan: {
      endpoint: { kind: "absolute", value: patch.endpoint ?? "https://example.test/v1" },
      path: "/chat/completions",
      method: patch.method ?? "POST",
      headers: [],
      query: [],
      authorization: { kind: "authorization.none" },
      transportExtensions: {},
    },
    payloadEncoder: { mediaType },
    successDecoder: { mediaType },
    errorDecoder: { mediaType },
    transport: {
      requiredCapabilities: new Set(),
      ...(patch.transportKind === undefined ? {} : { transportKind: patch.transportKind }),
    },
    modeComponents: [],
    typeContract: {},
    extensions: {},
  };
}

it("accepts a unary JSON HTTP plan by the same reference", () => {
  const executionPlan = plan({ transportKind: "transport.http" });

  expect(validateR1PlanScope({ mode, plan: executionPlan }).value).toBe(executionPlan);
  expect(validateR1PlanScope({ mode, plan: plan() }).value?.transportPlan.method).toBe("POST");
});

it("rejects a non-unary mode before reading the plan media type", () => {
  const result = validateR1PlanScope({
    mode: { id: "stream" },
    plan: plan({ mediaType: { type: "text", subtype: "plain", parameters: {} } }),
  });

  expect(result.value).toBeUndefined();
  expect(result.diagnostics[0]?.code).toBe("unsupported_interaction_mode");
});

it("rejects a non-JSON media type and a non-HTTP transport", () => {
  const media = validateR1PlanScope({
    mode,
    plan: plan({ mediaType: { type: "text", subtype: "plain", parameters: {} } }),
  });
  const transport = validateR1PlanScope({
    mode,
    plan: plan({ transportKind: "transport.websocket" }),
  });
  const method = validateR1PlanScope({ mode, plan: plan({ method: "GRPC" }) });
  const endpoint = validateR1PlanScope({
    mode,
    plan: plan({ endpoint: "wss://example.test/v1" }),
  });

  expect(media.diagnostics[0]?.code).toBe("unsupported_media_type");
  expect(transport.diagnostics[0]?.code).toBe("unsupported_transport");
  expect(method.diagnostics[0]?.path).toBe("transportPlan.method");
  expect(endpoint.diagnostics[0]?.path).toBe("transportPlan.endpoint");
  expect(endpoint.diagnostics[0]?.message).not.toMatch(/wss:/u);
});
