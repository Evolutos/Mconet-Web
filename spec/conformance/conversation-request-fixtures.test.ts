// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ConversationTaskBuilder,
  isConversationTaskRequest,
  isModelRequest,
  ModelRequestBuilder,
  type ModelRequest,
} from "../../packages/core-domain/src/index.js";
import { areJsonValuesCanonicallyEqual } from "../../packages/testing/src/canonical-json-comparator.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the language-neutral ModelRequest Schema. */
const modelRequestSchemaId = "https://schemas.evolutos.com/mconet/model/request";

/** Module-relative directory containing only reviewed conversation request Fixtures. */
const fixtureDirectory = fileURLToPath(
  new URL("../fixtures/conversation-request/", import.meta.url),
);

/** Exact filenames forming the current Conversation Request Fixture set. */
const expectedFixtureFileNames = ["ordered-multi-turn-unicode.json"] as const;

/** Existing component Fixtures deliberately reused by the composed request. */
const modelTargetFixturePath = fileURLToPath(
  new URL("../fixtures/model-target/complete.json", import.meta.url),
);
const serviceAccessFixturePath = fileURLToPath(
  new URL("../fixtures/service-access/complete.json", import.meta.url),
);
const messageDocumentFixturePath = fileURLToPath(
  new URL("../fixtures/message-document/multi-turn-unicode.json", import.meta.url),
);

/** Expected Task node order at the request root. */
const expectedTaskNodeIds = ["conversation-input", "generation-parameters"] as const;

/** Expected conversation chronology retained from the Message Fixture. */
const expectedEntryIds = [
  "turn-system",
  "turn-user-1",
  "turn-assistant-1",
  "turn-user-2",
  "turn-assistant-2",
] as const;

/** Expected role order paired with the five conversation entries. */
const expectedRoleIds = [
  "message.system",
  "message.user",
  "message.assistant",
  "message.user",
  "message.assistant",
] as const;

/** Expected content identity order including the final two-part response. */
const expectedContentIds = [
  "content-system",
  "content-user-1",
  "content-assistant-1",
  "content-user-2",
  "content-assistant-2-answer",
  "content-assistant-2-status",
] as const;

/** Exact Unicode text order, including newline and decomposed accent data. */
const expectedTexts = [
  "你是 Mconet 助手。",
  "第一轮：你好，世界 👋🏽\n请保留换行。",
  "已保留：café / café / 日本語。",
  "第二轮：请计算 2 × 3。",
  "答案是 6。",
  "状态：完成 ✅",
] as const;

/** Exact ordered stop sequences and generation values. */
const expectedGenerationParameters = {
  temperature: 0.25,
  topP: 0.9,
  maxOutputTokens: 512,
  stop: ["<END>", "停止", "🛑"],
  seed: 42,
} as const;

/** Ordered values observed from the composed request Fixture. */
interface ConversationRequestSnapshot {
  readonly taskNodeIds: readonly string[];
  readonly entryIds: readonly string[];
  readonly roleIds: readonly string[];
  readonly contentIds: readonly string[];
  readonly texts: readonly string[];
  readonly generationParameters: Readonly<Record<string, unknown>>;
}

describe("Conversation Request Fixtures", () => {
  // Exact set membership, composed contract validation, reused golden inputs,
  // Builder equivalence, every declared order, and JSON round-trip form one
  // atomic language-neutral request Fixture contract.
  it("keeps the complete reviewed Fixture set independently parseable", async () => {
    const fixtureFileNames = await listFixtureFileNames();

    // Exact membership prevents unrelated JSON from silently joining the
    // conformance surface or the sole representative request from disappearing.
    expect(fixtureFileNames).toEqual(expectedFixtureFileNames);
    for (const fixtureFileName of fixtureFileNames) {
      await expect(readFixture(fixtureFileName)).resolves.toBeDefined();
    }
  });

  it("validates every Fixture with Schema and Runtime contracts", async () => {
    const schema = await loadSchemaById(modelRequestSchemaId);
    const schemaValidator = new SchemaValidatorAdapter(schema);

    // Both independent boundaries inspect the same parsed language-neutral data;
    // neither Builder construction nor implementation-specific defaults assist it.
    for (const fixtureFileName of await listFixtureFileNames()) {
      const fixture = await readFixture(fixtureFileName);
      expect(schemaValidator.validate(fixture), fixtureFileName).toBe(true);
      expect(isModelRequest(fixture), fixtureFileName).toBe(true);
    }
  });

  it("reuses the complete Target and non-sensitive ServiceAccess Fixtures", async () => {
    const fixture = requireModelRequest(
      await readFixture("ordered-multi-turn-unicode.json"),
      "conversation request",
    );
    const expectedTarget = await readJsonFile(modelTargetFixturePath);
    const expectedAccess = await readJsonFile(serviceAccessFixturePath);

    // Canonical comparison ignores object member order but remains strict about
    // arrays, values, Unicode, duplicate headers/query fields, and empty strings.
    expect(areJsonValuesCanonicallyEqual(fixture.target, expectedTarget)).toBe(true);
    expect(areJsonValuesCanonicallyEqual(fixture.serviceAccess, expectedAccess)).toBe(true);
    expect(requireRecord(fixture.serviceAccess, "service access")).not.toHaveProperty(
      "authorization",
    );
  });

  it("reuses the Message golden tree with only request purpose narrowed", async () => {
    const fixture = requireModelRequest(
      await readFixture("ordered-multi-turn-unicode.json"),
      "conversation request",
    );
    const messages = getConversationMessages(fixture);
    const goldenMessages = requireRecord(
      await readJsonFile(messageDocumentFixturePath),
      "golden MessageDocument",
    );

    // The request must use input purpose, while root, metadata, and extensions
    // remain canonically identical to the independently reviewed Message Fixture.
    expect(messages.purpose).toBe("input");
    expect(goldenMessages.purpose).toBe("context");
    for (const memberName of ["version", "root", "metadata", "extensions"] as const) {
      expect(areJsonValuesCanonicallyEqual(messages[memberName], goldenMessages[memberName])).toBe(
        true,
      );
    }
  });

  it("matches the public Builders without mutating Fixture-owned values", async () => {
    const fixture = requireModelRequest(
      await readFixture("ordered-multi-turn-unicode.json"),
      "conversation request",
    );
    if (!isConversationTaskRequest(fixture.task)) {
      // The ModelRequest Runtime predicate currently narrows to conversation, but
      // this explicit guard gives the Builder call its concrete public type.
      throw new TypeError("Conversation request Fixture must contain a conversation task.");
    }
    const before = structuredClone(fixture);
    const builtTask = new ConversationTaskBuilder(fixture.task.document)
      .withArtifacts(fixture.task.artifacts)
      .withMetadata(fixture.task.metadata)
      .withExtensions(fixture.task.extensions)
      .build();
    const builtRequest = new ModelRequestBuilder(fixture.target, builtTask)
      .withServiceAccess(fixture.serviceAccess)
      .withMetadata(fixture.metadata)
      .withExtensions(fixture.extensions)
      .build();

    // Direct JSON construction and the two public convenience Builders must
    // produce the same data semantics while leaving parsed Fixture data intact.
    expect(areJsonValuesCanonicallyEqual(builtRequest, fixture)).toBe(true);
    expect(fixture).toEqual(before);
  });

  it("preserves Task, Message, role, content, text, and stop order", async () => {
    const fixture = requireModelRequest(
      await readFixture("ordered-multi-turn-unicode.json"),
      "conversation request",
    );
    const snapshot = createConversationRequestSnapshot(fixture);

    // Separate ordered observations make an accidental reorder at any domain
    // layer fail independently instead of being hidden by a flattened payload.
    expect(snapshot.taskNodeIds).toEqual(expectedTaskNodeIds);
    expect(snapshot.entryIds).toEqual(expectedEntryIds);
    expect(snapshot.roleIds).toEqual(expectedRoleIds);
    expect(snapshot.contentIds).toEqual(expectedContentIds);
    expect(snapshot.texts).toEqual(expectedTexts);
    expect(snapshot.generationParameters).toEqual(expectedGenerationParameters);
  });

  it("round-trips without changing request values or array order", async () => {
    const fixture = requireModelRequest(
      await readFixture("ordered-multi-turn-unicode.json"),
      "conversation request",
    );

    // JSON is the portable transport for Fixtures. Re-encoding creates an
    // independent value and canonical comparison still treats every array order
    // as significant.
    const roundTripped = JSON.parse(JSON.stringify(fixture)) as unknown;
    expect(areJsonValuesCanonicallyEqual(fixture, roundTripped)).toBe(true);
    expect(isModelRequest(roundTripped)).toBe(true);
    expect(
      createConversationRequestSnapshot(requireModelRequest(roundTripped, "round trip")),
    ).toEqual(createConversationRequestSnapshot(fixture));
  });
});

/** Lists regular JSON Fixture files in deterministic code-unit order. */
async function listFixtureFileNames(): Promise<readonly string[]> {
  const entries = await fs.readdir(fixtureDirectory, { withFileTypes: true });

  // Direct regular files only prevent symlinks, directories, and non-JSON
  // artifacts from becoming implicit conformance inputs.
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort(compareFileNames);
}

/** Reads one reviewed immediate-child Conversation Request Fixture. */
async function readFixture(fixtureFileName: string): Promise<unknown> {
  // The filename originates from the constrained directory scan, keeping the
  // read inside the dedicated Fixture set without caller-controlled traversal.
  return readJsonFile(path.join(fixtureDirectory, fixtureFileName));
}

/** Reads and parses one committed UTF-8 JSON file without coercion. */
async function readJsonFile(filePath: string): Promise<unknown> {
  const source = await fs.readFile(filePath, "utf8");

  // Native parsing preserves Unicode code points, newlines, duplicate array
  // entries, empty values, numeric values, and every declared array order.
  return JSON.parse(source) as unknown;
}

/** Narrows validated input to the public ModelRequest contract or fails setup. */
function requireModelRequest(value: unknown, context: string): ModelRequest {
  if (!isModelRequest(value)) {
    // Malformed committed data is a test setup error with a precise context,
    // never an unchecked cast that could make later order assertions misleading.
    throw new TypeError(`Expected ${context} to satisfy ModelRequest.`);
  }
  return value;
}

/** Returns the concrete input MessageDocument from the Fixture's Task tree. */
function getConversationMessages(request: ModelRequest): Record<string, unknown> {
  const task = requireRecord(request.task, "conversation task");
  const document = requireRecord(task.document, "conversation TaskDocument");
  const root = requireRecord(document.root, "conversation Task root");
  const children = requireArray(root.children, "conversation Task children");
  const input = requireRecord(children[0], "conversation input node");

  // The reviewed Fixture fixes conversation input as the first Task child; the
  // separate order assertion verifies this positional convention explicitly.
  return requireRecord(input.messages, "conversation input messages");
}

/** Extracts every ordered value required by the Fixture contract. */
function createConversationRequestSnapshot(request: ModelRequest): ConversationRequestSnapshot {
  const task = requireRecord(request.task, "conversation task");
  const document = requireRecord(task.document, "conversation TaskDocument");
  const root = requireRecord(document.root, "conversation Task root");
  const taskNodes = requireArray(root.children, "conversation Task children");
  const taskNodeIds = taskNodes.map((node, index) =>
    requireString(requireRecord(node, `Task node ${index}`).id, `Task node ${index} id`),
  );
  const messages = getConversationMessages(request);
  const messageRoot = requireRecord(messages.root, "Message root");
  const entries = requireArray(messageRoot.children, "Message entries");
  const entryIds: string[] = [];
  const roleIds: string[] = [];
  const contentIds: string[] = [];
  const texts: string[] = [];

  for (const [entryIndex, entryValue] of entries.entries()) {
    const entry = requireRecord(entryValue, `Message entry ${entryIndex}`);
    entryIds.push(requireString(entry.id, `Message entry ${entryIndex} id`));
    const role = requireRecord(entry.role, `Message entry ${entryIndex} role`);
    roleIds.push(requireString(role.id, `Message entry ${entryIndex} role id`));

    // Content order is independent inside every turn and must remain stable even
    // when one entry contains multiple text segments.
    for (const [contentIndex, contentValue] of requireArray(
      entry.content,
      `Message entry ${entryIndex} content`,
    ).entries()) {
      const content = requireRecord(contentValue, `content ${entryIndex}:${contentIndex}`);
      contentIds.push(requireString(content.id, `content ${entryIndex}:${contentIndex} id`));
      texts.push(requireString(content.text, `content ${entryIndex}:${contentIndex} text`));
    }
  }

  const parametersNode = requireRecord(taskNodes[1], "generation parameters node");
  const generationParameters = requireRecord(parametersNode.parameters, "generation parameters");
  return { taskNodeIds, entryIds, roleIds, contentIds, texts, generationParameters };
}

/** Returns an object record or fails at the exact malformed Fixture location. */
function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    // Every inspected location is a named JSON object and cannot be coerced from
    // arrays, primitives, or null without hiding malformed committed data.
    throw new TypeError(`Expected ${context} to be an object.`);
  }
  return value as Record<string, unknown>;
}

/** Returns one concrete JSON array or fails with location context. */
function requireArray(value: unknown, context: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    // Ordering assertions apply only to actual JSON arrays, never iterables or
    // array-like host objects with different membership semantics.
    throw new TypeError(`Expected ${context} to be an array.`);
  }
  return value;
}

/** Returns one string member without implicit conversion. */
function requireString(value: unknown, context: string): string {
  if (typeof value !== "string") {
    // Identifiers and text must already be exact strings in the committed JSON.
    throw new TypeError(`Expected ${context} to be a string.`);
  }
  return value;
}

/** Compares filenames using locale-independent UTF-16 code-unit order. */
function compareFileNames(left: string, right: string): number {
  // Explicit branches preserve deterministic behavior on every supported host.
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
