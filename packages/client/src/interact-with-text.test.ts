// Copyright © 2026 Mcont.

import type { ModelOutput, ModelRequest } from "@evolutos/mconet-core-domain";
import type { InteractionOptions } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { interactWithText } from "./interact-with-text.js";
import type { ModelInteractor } from "./model-interactor.js";

it("delegates a text conversation to interact once", async () => {
  const options: InteractionOptions = { includeRawResponse: false };
  const seen: Array<{ request: ModelRequest; options?: InteractionOptions }> = [];
  const output = createOutput();
  const interactor: ModelInteractor = {
    interact: (request, received) => {
      seen.push(received === undefined ? { request } : { request, options: received });
      return Promise.resolve(output);
    },
  };

  const result = await interactWithText(
    interactor,
    {
      target: {
        serviceId: "service.vendor",
        protocolId: "protocol.vendor",
        model: { name: "vendor-model", metadata: {}, extensions: {} },
        extensions: {},
      },
      messages: [{ role: "user", text: "Hello" }],
    },
    options,
  );

  expect(result).toBe(output);
  expect(seen).toHaveLength(1);
  expect(seen[0]?.options).toBe(options);
  expect(seen[0]?.request.task.descriptor.type).toBe("conversation.generate");
  expect(JSON.stringify(seen[0]?.request)).toContain("Hello");
});

function createOutput(): ModelOutput {
  return {
    target: {
      serviceId: "service.vendor",
      protocolId: "protocol.vendor",
      model: { name: "vendor-model", metadata: {}, extensions: {} },
      extensions: {},
    },
    status: "completed",
    result: {
      descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
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
