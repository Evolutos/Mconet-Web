// Copyright © 2026 Mcont.

import type { ModelOutput, ModelRequest } from "@evolutos/mconet-core-domain";
import type { InteractionOptions } from "@evolutos/mconet-core-spi";
import { expect, expectTypeOf, it } from "vitest";

import type { ModelInteractor } from "./model-interactor.js";

it("defines only interact", () => {
  // Equality rejects stream, close, and any second call style on this abstraction.
  expectTypeOf<ModelInteractor>().toEqualTypeOf<{
    interact(request: ModelRequest, options?: InteractionOptions): Promise<ModelOutput>;
  }>();
});

it("invokes the supplied interact function and allows omitted options", async () => {
  const request = createRequest();
  const output = createOutput(request);
  const interactor: ModelInteractor = {
    interact: (received) => Promise.resolve(received === request ? output : createOutput(received)),
  };

  // The interface adds no dispatcher. The caller function is the whole behavior.
  await expect(interactor.interact(request)).resolves.toBe(output);
  await expect(interactor.interact(request, {})).resolves.toBe(output);
});

function createRequest(): ModelRequest {
  return {
    target: {
      serviceId: "service.vendor",
      protocolId: "protocol.vendor",
      model: { name: "vendor-model", metadata: {}, extensions: {} },
      extensions: {},
    },
    task: {
      descriptor: { type: "vendor.document_compare", metadata: {}, extensions: {} },
      document: {
        version: "1.0",
        root: {
          id: "task-root",
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
  };
}

function createOutput(request: ModelRequest): ModelOutput {
  return {
    target: request.target,
    status: "completed",
    result: {
      descriptor: { type: "vendor.document_compare", metadata: {}, extensions: {} },
      document: {
        version: "1.0",
        root: {
          id: "result-root",
          kind: "task.result_root",
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
    diagnostics: [],
    protocolState: [],
    extensions: {},
  };
}
