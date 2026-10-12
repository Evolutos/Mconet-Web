// Copyright © 2026 Mcont.

import type { Diagnostic, ModelRequest, ParsedTaskResponse } from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { scheduleModelOutputAssembly } from "./schedule-model-output-assembly.js";

const request = {
  target: {
    serviceId: "service.vendor",
    protocolId: "protocol.vendor",
    model: { name: "requested-model", metadata: {}, extensions: {} },
    extensions: {},
  },
  task: {
    descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
    document: {
      version: "1.0",
      root: {
        id: "request-root",
        kind: "task.root",
        composition: "container",
        children: [],
        relations: [],
        metadata: {},
        extensions: {},
      },
      metadata: {},
      extensions: {},
    },
    artifacts: { artifacts: [] },
    metadata: {},
    extensions: {},
  },
  metadata: {},
  extensions: {},
} as ModelRequest;

const response = {
  result: {
    descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
    document: {
      version: "1.0",
      root: {
        id: "result-root",
        kind: "task.root",
        composition: "container",
        children: [],
        relations: [],
        metadata: {},
        extensions: {},
      },
      metadata: {},
      extensions: {},
    },
    artifacts: { artifacts: [] },
    metadata: {},
    extensions: {},
  },
  status: "completed",
  protocolState: [],
  extensions: {},
} as ParsedTaskResponse;

const diagnostics: readonly Diagnostic[] = [
  {
    code: "runtime.warning",
    severity: "warning",
    phase: "response_parsing",
    message: "Runtime observed a recoverable response condition.",
  },
];

it("keeps the request target, parsed status, and runtime diagnostics", () => {
  const output = scheduleModelOutputAssembly({ request, response, diagnostics });

  expect(output.target).toBe(request.target);
  expect(output.status).toBe("completed");
  expect(output.result).toBe(response.result);
  expect(output.diagnostics).toBe(diagnostics);
  expect(Object.isFrozen(output)).toBe(true);
  expect(Object.hasOwn(output, "resolvedModel")).toBe(false);
});
