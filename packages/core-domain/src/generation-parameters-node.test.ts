// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { Extensions } from "./extensions.js";
import type { GenerationParametersNode } from "./generation-parameters-node.js";
import type { GenerationParameters } from "./generation-parameters.js";
import type { JsonValue } from "./json-value.js";
import type { TaskRelation } from "./task-relation.js";

it("defines only generation configuration and shared Task-node fields", () => {
  // Exact equality excludes children, Message data, Artifacts, model selection,
  // access configuration, protocol payloads, and execution behavior.
  expectTypeOf<GenerationParametersNode>().toEqualTypeOf<{
    readonly id: string;
    readonly kind: "task.configuration";
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
    readonly composition: "leaf";
    readonly parameters: GenerationParameters;
  }>();
});

it("retains the complete generation controls by identity", () => {
  const parameters: GenerationParameters = {
    temperature: 0.7,
    topP: 0.95,
    maxOutputTokens: 512,
    stop: ["END"],
    seed: 42,
  };
  const node = createGenerationParametersNode(parameters);

  // The Task leaf neither flattens fields into its shared metadata nor copies,
  // normalizes, validates, or maps the protocol-neutral parameters object.
  expect(node.parameters).toBe(parameters);
  expect(node.parameters.stop).toBe(parameters.stop);
  expect(node.kind).toBe("task.configuration");
  expect(node.composition).toBe("leaf");
});

it("keeps node metadata separate from generation controls", () => {
  const parameters: GenerationParameters = {
    maxOutputTokens: 256,
  };
  const node: GenerationParametersNode = {
    id: "task-generation-parameters",
    kind: "task.configuration",
    composition: "leaf",
    parameters,
    relations: [],
    metadata: {
      source: "request-configuration",
    },
    extensions: {
      "provider.task-configuration": {
        priority: 0,
      },
    },
  };

  // Shared annotations stay outside the concrete generation value and cannot
  // become a sampling control, stop sequence, provider field, or default.
  expect(node.metadata).toEqual({ source: "request-configuration" });
  expect(node.extensions).toEqual({ "provider.task-configuration": { priority: 0 } });
  expect(node.parameters).toEqual({ maxOutputTokens: 256 });
});

it("requires fixed leaf structure and the generation payload", () => {
  // Missing parameters or container composition cannot satisfy the typed leaf;
  // no empty control object, children collection, or default is invented.
  expectTypeOf<{
    readonly id: string;
    readonly kind: "task.configuration";
    readonly composition: "leaf";
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<GenerationParametersNode>();
  expectTypeOf<{
    readonly id: string;
    readonly kind: "task.configuration";
    readonly composition: "container";
    readonly parameters: GenerationParameters;
    readonly relations: readonly TaskRelation[];
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly extensions: Extensions;
  }>().not.toMatchTypeOf<GenerationParametersNode>();
});

it("prevents configuration leaf and parameter replacement", () => {
  const proveReadonly = (
    node: GenerationParametersNode,
    parameters: GenerationParameters,
  ): void => {
    // Compile representative invalid writes while keeping this helper
    // unreachable from runtime tests and unable to mutate domain values.
    // @ts-expect-error Fixed configuration kind cannot be replaced.
    node.kind = "task.input";
    // @ts-expect-error Leaf composition cannot be replaced with a container.
    node.composition = "container";
    // @ts-expect-error GenerationParameters reference cannot be replaced.
    node.parameters = parameters;
    // @ts-expect-error Inherited identity cannot be replaced.
    node.id = "task-changed";
    // @ts-expect-error Inherited metadata entries remain readonly.
    node.metadata.status = "changed";
  };

  // Retain the helper so strict TypeScript validates every readonly constraint
  // without executing its intentionally invalid assignments.
  expectTypeOf(proveReadonly).toBeFunction();
});

/** Creates one complete configuration leaf for payload identity tests. */
function createGenerationParametersNode(
  parameters: GenerationParameters,
): GenerationParametersNode {
  // Build only the typed Task leaf around the caller's parameter reference;
  // construction performs no validation, defaults, mapping, or tree traversal.
  return {
    id: "task-generation-parameters",
    kind: "task.configuration",
    composition: "leaf",
    parameters,
    relations: [],
    metadata: {},
    extensions: {},
  };
}
