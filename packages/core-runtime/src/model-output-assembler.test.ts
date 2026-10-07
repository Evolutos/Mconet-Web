// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type {
  Diagnostic,
  ModelOutput,
  ModelRequest,
  ParsedTaskResponse,
} from "@evolutos/mconet-core-domain";

import { ModelOutputAssembler } from "./model-output-assembler.js";

it("assembles required values from their single authoritative owners", () => {
  const request = createRequest();
  const response = createResponse();
  const diagnostic = createDiagnostic("runtime.warning");
  const diagnostics = [diagnostic] as const;
  const output = ModelOutputAssembler.assemble({ request, response, diagnostics });

  // Target comes only from the request; service facts come only from the parsed
  // response; diagnostics come only from Runtime and retain collection identity.
  expect(output.target).toBe(request.target);
  expect(output.status).toBe(response.status);
  expect(output.result).toBe(response.result);
  expect(output.protocolState).toBe(response.protocolState);
  expect(output.extensions).toBe(response.extensions);
  expect(output.diagnostics).toBe(diagnostics);
});

it("preserves absent optional facts without request-derived synthesis", () => {
  const request = createRequest();
  const response = createResponse();
  const output = ModelOutputAssembler.assemble({ request, response, diagnostics: [] });

  // The requested model remains only inside target. Status does not invent a
  // reason or usage, and Runtime does not assign an ID unless explicitly asked.
  expect(Object.hasOwn(output, "id")).toBe(false);
  expect(Object.hasOwn(output, "resolvedModel")).toBe(false);
  expect(Object.hasOwn(output, "stopReason")).toBe(false);
  expect(Object.hasOwn(output, "usage")).toBe(false);
  expect(output.target.model.name).toBe("requested-model");
});

it("copies every explicitly reported optional fact by identity", () => {
  const request = createRequest();
  const resolvedModel = { name: "actual-model", metadata: {}, extensions: {} } as const;
  const usage = { inputTokens: 3, outputTokens: 2, totalTokens: 5, extensions: {} } as const;
  const response: ParsedTaskResponse = {
    ...createResponse(),
    resolvedModel,
    stopReason: "provider.stop",
    usage,
  };
  const output = ModelOutputAssembler.assemble({
    request,
    response,
    diagnostics: [],
    outputId: "runtime-output-1",
  });

  // Runtime ID is independent from protocol extensions and every parsed optional
  // value crosses the boundary without cloning, mapping, or normalization.
  expect(output.id).toBe("runtime-output-1");
  expect(output.resolvedModel).toBe(resolvedModel);
  expect(output.stopReason).toBe("provider.stop");
  expect(output.usage).toBe(usage);
});

it("keeps diagnostics separate from ordered protocol state", () => {
  const firstDiagnostic = createDiagnostic("runtime.first");
  const secondDiagnostic = createDiagnostic("runtime.second");
  const diagnostics = [firstDiagnostic, secondDiagnostic] as const;
  const response = createResponse();
  const output = ModelOutputAssembler.assemble({
    request: createRequest(),
    response,
    diagnostics,
  });

  // Neither ordered collection is merged, sorted, copied, or converted into the
  // other ownership domain during assembly.
  expect(output.diagnostics).toEqual([firstDiagnostic, secondDiagnostic]);
  expect(output.protocolState).toBe(response.protocolState);
  expect(output.diagnostics).not.toBe(output.protocolState);
});

it("creates a frozen outer output without mutating or freezing its inputs", () => {
  const request = createRequest();
  const response = createResponse();
  const diagnostics = [createDiagnostic("runtime.warning")];
  const requestBefore = structuredClone(request);
  const responseBefore = structuredClone(response);
  const output = ModelOutputAssembler.assemble({ request, response, diagnostics });

  // Only the newly allocated envelope is frozen. Existing owners and nested
  // collection identities remain untouched for their own lifecycle management.
  expect(Object.isFrozen(output)).toBe(true);
  expect(Object.isFrozen(request)).toBe(false);
  expect(Object.isFrozen(response)).toBe(false);
  expect(Object.isFrozen(diagnostics)).toBe(false);
  expect(request).toEqual(requestBefore);
  expect(response).toEqual(responseBefore);
});

it("allocates an independent envelope on every assembly", () => {
  const input = { request: createRequest(), response: createResponse(), diagnostics: [] } as const;
  const first = ModelOutputAssembler.assemble(input);
  const second = ModelOutputAssembler.assemble(input);

  // Stateless assembly never caches a public output, while factual nested values
  // continue to share their authoritative caller-owned identities.
  expect(first).not.toBe(second);
  expect(first.target).toBe(second.target);
  expect(first.result).toBe(second.result);
});

it("is a frozen Runtime factory rather than a mutable instance abstraction", () => {
  // The method accepts only the three ownership inputs plus optional Runtime ID,
  // and the factory surface cannot be replaced or extended at runtime.
  expectTypeOf(ModelOutputAssembler.assemble).toEqualTypeOf<
    (input: {
      readonly request: ModelRequest;
      readonly response: ParsedTaskResponse;
      readonly diagnostics: readonly Diagnostic[];
      readonly outputId?: string;
    }) => ModelOutput
  >();
  expect(Object.isFrozen(ModelOutputAssembler)).toBe(true);
});

/** Creates one request with a distinct requested target and minimal valid Task. */
function createRequest(): ModelRequest {
  // The assembler reads target only; the remaining complete request shape proves
  // no Task or access property is promoted into ModelOutput.
  return {
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
  };
}

/** Creates required parsed facts with all optional facts absent. */
function createResponse(): ParsedTaskResponse {
  const protocolState = [
    {
      serviceId: "service.vendor",
      protocolId: "protocol.vendor",
      stateType: "response.cursor",
      stateValue: "cursor-1",
    },
  ] as const;
  const extensions = { "provider.response_id": "provider-response-1" } as const;

  // Result and service facts are explicit and independent from request target.
  return {
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
    protocolState,
    extensions,
  };
}

/** Creates one Runtime-owned diagnostic without protocol state. */
function createDiagnostic(code: string): Diagnostic {
  // A stable technical observation remains separate from service result facts.
  return {
    code,
    severity: "warning",
    phase: "response_parsing",
    message: "Runtime observed a recoverable response condition.",
  };
}
