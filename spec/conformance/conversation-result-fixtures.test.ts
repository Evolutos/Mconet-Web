// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isMessageDocument,
  isModelRequest,
  isParsedTaskResponse,
  projectConversationText,
  type ConversationTaskResult,
  type Diagnostic,
  type JsonValue,
  type ModelRequest,
  type ParsedTaskResponse,
} from "../../packages/core-domain/src/index.js";
import { ModelOutputAssembler } from "../../packages/core-runtime/src/model-output-assembler.js";
import { areJsonValuesCanonicallyEqual } from "../../packages/testing/src/canonical-json-comparator.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";
import { describe, expect, it } from "vitest";

/** Stable identifier of the language-neutral ModelOutput Schema. */
const modelOutputSchemaId = "https://schemas.evolutos.com/mconet/model/output";

/** Module-relative directory containing reviewed conversation result Fixtures. */
const fixtureDirectory = fileURLToPath(
  new URL("../fixtures/conversation-result/", import.meta.url),
);

/** Exact current Conversation Result Fixture membership. */
const expectedFixtureFileNames = ["ordered-assistant-text.json"] as const;

/** Request Fixture whose target must be retained by Runtime assembly. */
const requestFixturePath = fileURLToPath(
  new URL("../fixtures/conversation-request/ordered-multi-turn-unicode.json", import.meta.url),
);

/** Expected recursive Message group order. */
const expectedGroupIds = ["result-messages", "primary", "follow-up"] as const;

/** Expected preorder of all Message entries, including ignored user text. */
const expectedEntryIds = ["entry-assistant-1", "entry-user-ignored", "entry-assistant-2"] as const;

/** Expected role order paired with all result entries. */
const expectedRoleIds = ["message.assistant", "message.user", "message.assistant"] as const;

/** Expected content order before assistant-role filtering. */
const expectedContentIds = [
  "content-assistant-1a",
  "content-assistant-1b",
  "content-user-ignored",
  "content-assistant-2",
] as const;

/** Expected assistant segments selected in preorder. */
const expectedAssistantSegments = ["你好，", "世界 🌍", "\n第二行 é"] as const;

/** Exact projection with no SDK-inserted separator or Unicode normalization. */
const expectedProjectedText = "你好，世界 🌍\n第二行 é";

/** Expected Runtime diagnostic and protocol-state order. */
const expectedDiagnosticCodes = ["response.compatibility", "response.metadata"] as const;
const expectedProtocolStateTypes = ["state.response_id", "state.region"] as const;

/** Ordered result observations used by independent assertions and round trips. */
interface ConversationResultSnapshot {
  readonly groupIds: readonly string[];
  readonly entryIds: readonly string[];
  readonly roleIds: readonly string[];
  readonly contentIds: readonly string[];
  readonly assistantSegments: readonly string[];
  readonly diagnosticCodes: readonly string[];
  readonly protocolStateTypes: readonly string[];
}

describe("Conversation Result Fixtures", () => {
  // The set, Schema contract, request-target link, Runtime assembly, text
  // projection, completion facts, declared orders, and JSON round trip form one
  // atomic result Fixture contract.
  it("keeps the complete reviewed Fixture set independently parseable", async () => {
    const fixtureFileNames = await listFixtureFileNames();

    // Exact membership rejects accidental extra outputs and missing golden data.
    expect(fixtureFileNames).toEqual(expectedFixtureFileNames);
    for (const fixtureFileName of fixtureFileNames) {
      await expect(readFixture(fixtureFileName)).resolves.toBeDefined();
    }
  });

  it("validates every Fixture with the standalone ModelOutput Schema", async () => {
    const schema = await loadSchemaById(modelOutputSchemaId);
    const schemaValidator = new SchemaValidatorAdapter(schema);

    // Every file is parsed and validated independently without companion Schema
    // registration, Builder defaults, Runtime repair, or external references.
    for (const fixtureFileName of await listFixtureFileNames()) {
      const fixture = await readFixture(fixtureFileName);
      expect(schemaValidator.validate(fixture), fixtureFileName).toBe(true);
    }
  });

  it("retains the originating request target exactly", async () => {
    const output = requireRecord(await readFixture("ordered-assistant-text.json"), "output");
    const request = requireModelRequest(await readJsonFile(requestFixturePath), "request Fixture");

    // Runtime owns target retention. Resolved model remains a separate service
    // fact and cannot overwrite or normalize the requested target.
    expect(areJsonValuesCanonicallyEqual(output.target, request.target)).toBe(true);
    expect(requireRecord(output.resolvedModel, "resolved model").name).not.toBe(
      requireRecord(requireRecord(output.target, "output target").model, "target model").name,
    );
  });

  it("matches the Runtime assembler ownership boundary", async () => {
    const fixture = requireRecord(await readFixture("ordered-assistant-text.json"), "output");
    const request = requireModelRequest(await readJsonFile(requestFixturePath), "request Fixture");
    const response = requireParsedResponse(fixture);
    const diagnostics = requireDiagnostics(fixture.diagnostics);
    const outputId = requireString(fixture.id, "output id");
    const before = structuredClone(fixture);

    // Reconstruct only the three factual owners accepted by the internal Runtime
    // factory. Canonical equality proves no owner or optional fact is invented.
    const assembled = ModelOutputAssembler.assemble({
      request,
      response,
      diagnostics,
      outputId,
    });
    expect(areJsonValuesCanonicallyEqual(assembled, fixture)).toBe(true);
    expect(fixture).toEqual(before);
  });

  it("projects only ordered assistant text without normalization", async () => {
    const fixture = requireRecord(await readFixture("ordered-assistant-text.json"), "output");
    const response = requireParsedResponse(fixture);
    const result = requireConversationResult(response);
    const snapshot = createConversationResultSnapshot(fixture);

    // The user-role segment remains authoritative in MessageDocument but is not
    // included in the assistant convenience projection.
    expect(snapshot.assistantSegments).toEqual(expectedAssistantSegments);
    expect(projectConversationText(result)).toBe(expectedProjectedText);
    expect(projectConversationText(result)).not.toContain("不得进入结果文本");
  });

  it("preserves status, finish reason, usage, diagnostics, and protocol state", async () => {
    const fixture = requireRecord(await readFixture("ordered-assistant-text.json"), "output");
    const snapshot = createConversationResultSnapshot(fixture);

    // Completion facts remain independent: total usage is a provider fact, stop
    // reason is not inferred from status, and both ordered observation channels
    // keep their original membership.
    expect(fixture.status).toBe("completed");
    expect(fixture.stopReason).toBe("stop");
    expect(fixture.usage).toEqual({
      inputTokens: 37,
      outputTokens: 12,
      totalTokens: 49,
      extensions: { "vendor.cachedInputTokens": 8 },
    });
    expect(snapshot.diagnosticCodes).toEqual(expectedDiagnosticCodes);
    expect(snapshot.protocolStateTypes).toEqual(expectedProtocolStateTypes);
  });

  it("preserves recursive group, entry, role, and content order", async () => {
    const fixture = requireRecord(await readFixture("ordered-assistant-text.json"), "output");
    const snapshot = createConversationResultSnapshot(fixture);

    // Each ordering layer is asserted separately so a traversal, protocol, or
    // serialization reorder fails at its actual ownership boundary.
    expect(snapshot.groupIds).toEqual(expectedGroupIds);
    expect(snapshot.entryIds).toEqual(expectedEntryIds);
    expect(snapshot.roleIds).toEqual(expectedRoleIds);
    expect(snapshot.contentIds).toEqual(expectedContentIds);
  });

  it("round-trips without changing facts, order, or projected text", async () => {
    const fixture = requireRecord(await readFixture("ordered-assistant-text.json"), "output");
    const schema = await loadSchemaById(modelOutputSchemaId);
    const schemaValidator = new SchemaValidatorAdapter(schema);

    // JSON transport creates an independent value while preserving exact array
    // order, newline, emoji, and decomposed accent code points.
    const roundTripped = JSON.parse(JSON.stringify(fixture)) as unknown;
    expect(schemaValidator.validate(roundTripped)).toBe(true);
    expect(areJsonValuesCanonicallyEqual(fixture, roundTripped)).toBe(true);
    const roundTripRecord = requireRecord(roundTripped, "round-tripped output");
    expect(createConversationResultSnapshot(roundTripRecord)).toEqual(
      createConversationResultSnapshot(fixture),
    );
    expect(
      projectConversationText(requireConversationResult(requireParsedResponse(roundTripRecord))),
    ).toBe(expectedProjectedText);
  });
});

/** Lists direct regular JSON Fixture files in deterministic code-unit order. */
async function listFixtureFileNames(): Promise<readonly string[]> {
  const entries = await fs.readdir(fixtureDirectory, { withFileTypes: true });

  // Direct-file filtering prevents nested directories, symlinks, and unrelated
  // artifacts from silently extending the conformance input set.
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort(compareFileNames);
}

/** Reads one reviewed immediate-child Conversation Result Fixture. */
async function readFixture(fixtureFileName: string): Promise<unknown> {
  // The constrained scan supplies the filename, keeping the read within the
  // dedicated Fixture directory without caller-controlled traversal.
  return readJsonFile(path.join(fixtureDirectory, fixtureFileName));
}

/** Reads and parses one committed UTF-8 JSON file without coercion. */
async function readJsonFile(filePath: string): Promise<unknown> {
  const source = await fs.readFile(filePath, "utf8");

  // Native parsing retains array order and every exact Unicode/string/number
  // value used by the cross-language conformance contract.
  return JSON.parse(source) as unknown;
}

/** Narrows one parsed request Fixture through the public Runtime validator. */
function requireModelRequest(value: unknown, context: string): ModelRequest {
  if (!isModelRequest(value)) {
    // A malformed dependency Fixture fails setup explicitly instead of entering
    // Runtime assembly through an unchecked cast.
    throw new TypeError(`Expected ${context} to satisfy ModelRequest.`);
  }
  return value;
}

/** Reconstructs and validates the service-owned ParsedTaskResponse facts. */
function requireParsedResponse(output: Record<string, unknown>): ParsedTaskResponse {
  const response = {
    result: output.result,
    resolvedModel: output.resolvedModel,
    status: output.status,
    stopReason: output.stopReason,
    usage: output.usage,
    protocolState: output.protocolState,
    extensions: output.extensions,
  };

  // The dedicated predicate checks result, optional facts, token bounds,
  // protocol-state JSON, extensions, and exact presence without Runtime repair.
  if (!isParsedTaskResponse(response)) {
    throw new TypeError("Conversation Result Fixture must contain parsed response facts.");
  }
  return response;
}

/** Narrows the standard result and validates its independent MessageDocument. */
function requireConversationResult(response: ParsedTaskResponse): ConversationTaskResult {
  const result = response.result;
  const resultRecord = requireRecord(result, "conversation result");
  const messages = resultRecord.messages;
  if (result.descriptor.type !== "conversation.generate" || !isMessageDocument(messages)) {
    // Generic response validation intentionally stays task-neutral; this Fixture
    // adds the concrete standard task identity and Message boundary explicitly.
    throw new TypeError("Expected one conversation result with a valid MessageDocument.");
  }

  // Construct a typed view without changing the authoritative result or Message
  // references; only the fixed descriptor literal is restated for TypeScript.
  return {
    ...result,
    descriptor: { ...result.descriptor, type: "conversation.generate" },
    messages,
  };
}

/** Parses Runtime diagnostic data into its exact public value contract. */
function requireDiagnostics(value: unknown): readonly Diagnostic[] {
  const diagnostics = requireArray(value, "diagnostics");

  // Reconstruct plain values field-by-field so Runtime assembly receives no
  // unchecked object cast and optional absence remains exact.
  return diagnostics.map((item, index) => {
    const record = requireRecord(item, `diagnostic ${index}`);
    const pathValue = record.path;
    const serviceIdValue = record.serviceId;
    const detailsValue = record.details;
    return {
      code: requireString(record.code, `diagnostic ${index} code`),
      severity: requireSeverity(record.severity, `diagnostic ${index} severity`),
      phase: requireString(record.phase, `diagnostic ${index} phase`),
      message: requireString(record.message, `diagnostic ${index} message`),
      ...(pathValue === undefined
        ? {}
        : { path: requireString(pathValue, `diagnostic ${index} path`) }),
      ...(serviceIdValue === undefined
        ? {}
        : { serviceId: requireString(serviceIdValue, `diagnostic ${index} serviceId`) }),
      ...(detailsValue === undefined
        ? {}
        : { details: requireJsonValue(detailsValue, `diagnostic ${index} details`) }),
    };
  });
}

/** Creates ordered observations from the complete output Fixture. */
function createConversationResultSnapshot(
  output: Record<string, unknown>,
): ConversationResultSnapshot {
  const result = requireRecord(output.result, "conversation result");
  const messages = requireRecord(result.messages, "result MessageDocument");
  const root = requireRecord(messages.root, "result Message root");
  const groupIds: string[] = [];
  const entryIds: string[] = [];
  const roleIds: string[] = [];
  const contentIds: string[] = [];
  const assistantSegments: string[] = [];
  const pending: Record<string, unknown>[] = [root];

  // Iterative preorder mirrors production projection without recursion depth or
  // mutation; reverse pushes restore declared left-to-right child order.
  let element = pending.pop();
  while (element !== undefined) {
    const kind = requireString(element.kind, "Message element kind");
    if (kind === "message.entry") {
      entryIds.push(requireString(element.id, "Message entry id"));
      const role = requireRecord(element.role, "Message role");
      const roleId = requireString(role.id, "Message role id");
      roleIds.push(roleId);
      for (const contentValue of requireArray(element.content, "Message content")) {
        const content = requireRecord(contentValue, "Message content item");
        contentIds.push(requireString(content.id, "Message content id"));
        if (roleId === "message.assistant") {
          assistantSegments.push(requireString(content.text, "assistant text"));
        }
      }
    } else {
      groupIds.push(requireString(element.id, "Message group id"));
      const children = requireArray(element.children, "Message group children");
      for (let index = children.length - 1; index >= 0; index -= 1) {
        pending.push(requireRecord(children[index], `Message child ${index}`));
      }
    }
    element = pending.pop();
  }

  const diagnostics = requireArray(output.diagnostics, "diagnostics");
  const protocolState = requireArray(output.protocolState, "protocol state");
  return {
    groupIds,
    entryIds,
    roleIds,
    contentIds,
    assistantSegments,
    diagnosticCodes: diagnostics.map((item, index) =>
      requireString(requireRecord(item, `diagnostic ${index}`).code, `diagnostic ${index} code`),
    ),
    protocolStateTypes: protocolState.map((item, index) =>
      requireString(
        requireRecord(item, `protocol state ${index}`).stateType,
        `protocol state ${index} type`,
      ),
    ),
  };
}

/** Recursively validates and returns one portable JSON value. */
function requireJsonValue(value: unknown, context: string): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      throw new TypeError(`Expected ${context} number to be portable JSON.`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    // Array order is retained while every item is validated recursively.
    return value.map((item, index) => requireJsonValue(item, `${context}[${index}]`));
  }

  const record = requireRecord(value, context);
  const result: Record<string, JsonValue> = {};
  for (const [key, member] of Object.entries(record)) {
    // Reconstruct only enumerable JSON members and reject unsupported values at
    // their exact object path.
    result[key] = requireJsonValue(member, `${context}.${key}`);
  }
  return result;
}

/** Returns one supported diagnostic severity literal. */
function requireSeverity(value: unknown, context: string): Diagnostic["severity"] {
  if (value !== "info" && value !== "warning" && value !== "error") {
    throw new TypeError(`Expected ${context} to be a supported severity.`);
  }
  return value;
}

/** Returns an object record or fails at the exact malformed Fixture location. */
function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    // Named Fixture structures cannot be coerced from arrays or primitives.
    throw new TypeError(`Expected ${context} to be an object.`);
  }
  return value as Record<string, unknown>;
}

/** Returns one concrete array without accepting array-like values. */
function requireArray(value: unknown, context: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    // All order guarantees in this Fixture depend on actual JSON arrays.
    throw new TypeError(`Expected ${context} to be an array.`);
  }
  return value;
}

/** Returns one exact string without normalization or coercion. */
function requireString(value: unknown, context: string): string {
  if (typeof value !== "string") {
    // Identifiers and text must already use their portable JSON representation.
    throw new TypeError(`Expected ${context} to be a string.`);
  }
  return value;
}

/** Compares filenames using locale-independent UTF-16 code-unit order. */
function compareFileNames(left: string, right: string): number {
  // Explicit branches avoid host locale and collation differences.
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
