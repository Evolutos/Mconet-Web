// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { ModelDescriptor } from "./model-descriptor.js";
import type { ModelTarget } from "./model-target.js";
import { NamedModel } from "./named-model.js";
import type { OpenIdentifier } from "./open-identifier.js";

it("defines the complete immutable model target shape", () => {
  // Assert the exact public field set so access credentials, endpoints, tasks,
  // or inferred protocol state cannot enter this target-only contract silently.
  expectTypeOf<ModelTarget>().toEqualTypeOf<{
    readonly serviceId: OpenIdentifier;
    readonly protocolId: OpenIdentifier;
    readonly model: ModelDescriptor;
    readonly deploymentId?: string;
    readonly extensions: Extensions;
  }>();
});

it("keeps service, protocol, and model identity independent", () => {
  const target: ModelTarget = {
    serviceId: "company.gateway",
    protocolId: "openai.chat.completions",
    model: new NamedModel("vendor/model-v2"),
    extensions: {},
  };

  // Distinct values prove no field aliases another identity or derives the
  // protocol from the service/model spelling.
  expect(target.serviceId).toBe("company.gateway");
  expect(target.protocolId).toBe("openai.chat.completions");
  expect(target.model.name).toBe("vendor/model-v2");
  expect(Object.hasOwn(target, "deploymentId")).toBe(false);
  expect(target.extensions).toEqual({});
});

it("preserves an optional deployment and namespaced extensions", () => {
  const target: ModelTarget = {
    serviceId: "vendor.service",
    protocolId: "vendor.native",
    model: {
      name: "model-name",
      family: "vendor.text",
      metadata: {},
      extensions: {},
    },
    deploymentId: "deployment-blue",
    extensions: {
      "vendor.routing": {
        region: "global",
        canary: false,
      },
    },
  };

  // Deployment remains an opaque string, while extension values stay inside
  // their declared map instead of becoming access or protocol parameters.
  expect(target.deploymentId).toBe("deployment-blue");
  expect(target.extensions).toEqual({
    "vendor.routing": {
      region: "global",
      canary: false,
    },
  });
});

it("accepts application-owned model descriptor fields structurally", () => {
  const applicationModel = {
    name: "private-model",
    metadata: {},
    extensions: {},
    deploymentRegion: "internal-zone",
  } as const;
  const target: ModelTarget = {
    serviceId: "private.service",
    protocolId: "private.protocol",
    model: applicationModel,
    extensions: {},
  };

  // ModelTarget depends on the open ModelDescriptor protocol and does not erase
  // application-owned fields from the original model object.
  expect(target.model.name).toBe("private-model");
  expect(applicationModel.deploymentRegion).toBe("internal-zone");
});

it("requires every non-optional target field at compile time", () => {
  expectTypeOf<{
    readonly protocolId: OpenIdentifier;
    readonly model: ModelDescriptor;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ModelTarget>();
  expectTypeOf<{
    readonly serviceId: OpenIdentifier;
    readonly model: ModelDescriptor;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ModelTarget>();
  expectTypeOf<{
    readonly serviceId: OpenIdentifier;
    readonly protocolId: OpenIdentifier;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<ModelTarget>();
  expectTypeOf<{
    readonly serviceId: OpenIdentifier;
    readonly protocolId: OpenIdentifier;
    readonly model: ModelDescriptor;
  }>().not.toMatchTypeOf<ModelTarget>();
});

it("prevents target field replacement and extension writes at compile time", () => {
  const proveReadonly = (target: ModelTarget): void => {
    // Exercise representative identity, object-reference, optional, and nested
    // writes solely for compile-time verification; this helper is never called.
    // @ts-expect-error Service identity cannot be replaced.
    target.serviceId = "changed.service";
    // @ts-expect-error Protocol identity cannot be replaced.
    target.protocolId = "changed.protocol";
    // @ts-expect-error The model descriptor reference cannot be replaced.
    target.model = new NamedModel("changed-model");
    // @ts-expect-error Optional deployment identity cannot be replaced.
    target.deploymentId = "changed-deployment";
    // @ts-expect-error Target extension entries are readonly.
    target.extensions["vendor.routing"] = null;
  };

  expectTypeOf(proveReadonly).toBeFunction();
});
