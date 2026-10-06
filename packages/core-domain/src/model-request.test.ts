// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { JsonValue } from "./json-value.js";
import type { ModelRequest } from "./model-request.js";
import type { ModelTarget } from "./model-target.js";
import type { ModelTaskRequest } from "./model-task-request.js";
import type { ServiceAccess } from "./service-access.js";

it("defines exactly the task-neutral interaction envelope", () => {
  // Exact equality excludes Message and generation shortcuts, interaction mode,
  // runtime options, components, protocol payloads, and transport state.
  expectTypeOf<ModelRequest>().toEqualTypeOf<{
    readonly target: ModelTarget;
    readonly task: ModelTaskRequest;
    readonly serviceAccess?: ServiceAccess;
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>();
});

it("accepts an application-defined structural request", () => {
  const request = {
    ...createModelRequest(createServiceAccess()),
    applicationTraceId: "trace-a",
  } as const;

  // Structural openness permits an application envelope without SDK inheritance,
  // global registration, conversion, validation, or loss of its own field.
  expect(acceptModelRequest(request)).toBe(request);
  expect(request.applicationTraceId).toBe("trace-a");
});

it("keeps target task access and annotations independent", () => {
  const target = createModelTarget();
  const task = createModelTaskRequest();
  const serviceAccess = createServiceAccess();
  const metadata = { traceLabel: "request-a" } as const;
  const extensions = { "application.request": { priority: 2 } } as const;
  const request: ModelRequest = {
    target,
    task,
    serviceAccess,
    metadata,
    extensions,
  };

  // The envelope preserves every caller-owned object by identity and never
  // derives protocol, task input, endpoint, credentials, or execution state.
  expect(request.target).toBe(target);
  expect(request.task).toBe(task);
  expect(request.serviceAccess).toBe(serviceAccess);
  expect(request.metadata).toBe(metadata);
  expect(request.extensions).toBe(extensions);
});

it("allows the request-level access contribution to be absent", () => {
  const request = createModelRequest();

  // True absence means this layer contributes no ServiceAccess; it does not
  // synthesize anonymous access, an endpoint, authorization, or empty override.
  expect(Object.hasOwn(request, "serviceAccess")).toBe(false);
  expect(request.serviceAccess).toBeUndefined();
});

it("keeps task-specific and runtime fields out of the envelope", () => {
  const request = createModelRequest();

  // Conversation data and generation controls remain inside task.document;
  // execution mode, components, and transport are owned by later boundaries.
  expect("messages" in request).toBe(false);
  expect("generationParameters" in request).toBe(false);
  expect("interactionMode" in request).toBe(false);
  expect("components" in request).toBe(false);
  expect("transport" in request).toBe(false);
  expectTypeOf<{
    readonly target: ModelTarget;
    readonly task: ModelTaskRequest;
  }>().not.toMatchTypeOf<ModelRequest>();
});

it("prevents replacement of every request boundary", () => {
  const proveReadonly = (
    request: ModelRequest,
    target: ModelTarget,
    task: ModelTaskRequest,
    serviceAccess: ServiceAccess,
  ): void => {
    // Compile representative invalid writes without executing this helper or
    // mutating any request object at runtime.
    // @ts-expect-error Target selection cannot be replaced.
    request.target = target;
    // @ts-expect-error Task request cannot be replaced.
    request.task = task;
    // @ts-expect-error Optional access contribution cannot be replaced.
    request.serviceAccess = serviceAccess;
    // @ts-expect-error Metadata entries remain readonly.
    request.metadata.status = "changed";
    // @ts-expect-error Extension entries remain readonly.
    request.extensions["application.request"] = null;
  };

  // Retain the helper so strict TypeScript enforces all readonly constraints.
  expectTypeOf(proveReadonly).toBeFunction();
});

/** Returns one request unchanged through the public structural boundary. */
function acceptModelRequest(request: ModelRequest): ModelRequest {
  // Identity preservation proves the type adds no constructor, registry,
  // normalization, resolution, validation, or dispatch behavior.
  return request;
}

/** Creates a complete target with distinct service and protocol identities. */
function createModelTarget(): ModelTarget {
  // Explicitly separate protocol selection from model name and access endpoint.
  return {
    serviceId: "service.vendor",
    protocolId: "protocol.vendor",
    model: {
      name: "vendor-model",
      metadata: {},
      extensions: {},
    },
    deploymentId: "primary",
    extensions: {},
  };
}

/** Creates a complete non-conversation task to prove task neutrality. */
function createModelTaskRequest(): ModelTaskRequest {
  // Keep all task-specific identity and input inside the nested task contract.
  return {
    descriptor: {
      type: "vendor.document_compare",
      metadata: {},
      extensions: {},
    },
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
  };
}

/** Creates one unresolved request-level service access contribution. */
function createServiceAccess(): ServiceAccess {
  // Access remains independent from ModelTarget and carries no resolved defaults
  // or credential value; later configuration and authorization layers own both.
  return {
    endpoint: {
      kind: "absolute",
      value: "https://models.example.test/v1",
    },
    authorization: { kind: "authorization.vendor_signature" },
    headers: [{ name: "x-feature", value: "enabled" }],
    query: [{ name: "region", value: "east" }],
    extensions: {},
  };
}

/** Creates the smallest complete task-neutral request. */
function createModelRequest(serviceAccess?: ServiceAccess): ModelRequest {
  const common = {
    target: createModelTarget(),
    task: createModelTaskRequest(),
    metadata: {},
    extensions: {},
  } as const;

  // Preserve exact optional-property semantics: omit the member completely when
  // this request layer supplies no access contribution.
  return serviceAccess === undefined ? common : { ...common, serviceAccess };
}
