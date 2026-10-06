// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { isMessageDocument } from "../../packages/core-domain/src/message-document.js";
import { areJsonValuesCanonicallyEqual } from "../../packages/testing/src/canonical-json-comparator.js";
import { loadSchemaById } from "../schema-loader.js";
import { SchemaValidatorAdapter } from "../schema-validator-adapter.js";

/** Stable identifier of the language-neutral MessageDocument Schema. */
const messageDocumentSchemaId = "https://schemas.evolutos.com/mconet/message/document";

/** Module-relative directory containing only committed MessageDocument Fixtures. */
const fixtureDirectory = fileURLToPath(new URL("../fixtures/message-document/", import.meta.url));

/** Exact filenames forming the reviewed MessageDocument Fixture set. */
const expectedFixtureFileNames = ["multi-turn-unicode.json"] as const;

/** Expected conversation chronology at the MessageEntry boundary. */
const expectedEntryIds = [
  "turn-system",
  "turn-user-1",
  "turn-assistant-1",
  "turn-user-2",
  "turn-assistant-2",
] as const;

/** Expected role chronology paired one-to-one with the ordered entries. */
const expectedRoleIds = [
  "message.system",
  "message.user",
  "message.assistant",
  "message.user",
  "message.assistant",
] as const;

/** Expected content chronology, including two ordered values in the final entry. */
const expectedContentIds = [
  "content-system",
  "content-user-1",
  "content-assistant-1",
  "content-user-2",
  "content-assistant-2-answer",
  "content-assistant-2-status",
] as const;

/** Exact Unicode strings that must survive JSON transport without normalization. */
const expectedTexts = [
  "你是 Mconet 助手。",
  "第一轮：你好，世界 👋🏽\n请保留换行。",
  "已保留：café / café / 日本語。",
  "第二轮：请计算 2 × 3。",
  "答案是 6。",
  "状态：完成 ✅",
] as const;

/** Ordered fields observed from the representative MessageDocument Fixture. */
interface MessageFixtureSnapshot {
  readonly entryIds: readonly string[];
  readonly roleIds: readonly string[];
  readonly contentIds: readonly string[];
  readonly texts: readonly string[];
}

describe("MessageDocument Fixtures", () => {
  // Cover exact set membership, both public validation contracts, turn and
  // content ordering, exact Unicode preservation, and JSON round-trip behavior.
  it("keeps the complete reviewed Fixture set independently parseable", async () => {
    const fixtureFileNames = await listFixtureFileNames();

    // Exact membership prevents missing conversation coverage or unrelated JSON
    // files from silently becoming Message conformance inputs.
    expect(fixtureFileNames).toEqual(expectedFixtureFileNames);

    // Parse each file separately so malformed JSON identifies its exact source.
    for (const fixtureFileName of fixtureFileNames) {
      await expect(readFixture(fixtureFileName)).resolves.toBeDefined();
    }
  });

  it("validates every Fixture with both Schema and runtime contracts", async () => {
    const schema = await loadSchemaById(messageDocumentSchemaId);
    const schemaValidator = new SchemaValidatorAdapter(schema);

    // Both validators inspect the same parsed data, proving the committed
    // language-neutral input does not rely on one implementation boundary.
    for (const fixtureFileName of await listFixtureFileNames()) {
      const fixture = await readFixture(fixtureFileName);
      expect(schemaValidator.validate(fixture), fixtureFileName).toBe(true);
      expect(isMessageDocument(fixture), fixtureFileName).toBe(true);
    }
  });

  it("preserves multi-turn, role, content, and Unicode order", async () => {
    const fixture = await readFixture("multi-turn-unicode.json");
    const snapshot = createMessageFixtureSnapshot(fixture);

    // Separate arrays make every ordering layer explicit: conversation turns,
    // participant roles, content items, and exact text code-point sequences.
    expect(snapshot.entryIds).toEqual(expectedEntryIds);
    expect(snapshot.roleIds).toEqual(expectedRoleIds);
    expect(snapshot.contentIds).toEqual(expectedContentIds);
    expect(snapshot.texts).toEqual(expectedTexts);
  });

  it("round-trips without changing order or Unicode text", async () => {
    const fixture = await readFixture("multi-turn-unicode.json");

    // JSON is the portable Fixture transport. Re-encoding creates an independent
    // value while canonical comparison keeps array order semantically strict.
    const roundTrippedFixture = JSON.parse(JSON.stringify(fixture)) as unknown;
    expect(areJsonValuesCanonicallyEqual(fixture, roundTrippedFixture)).toBe(true);
    expect(createMessageFixtureSnapshot(roundTrippedFixture)).toEqual(
      createMessageFixtureSnapshot(fixture),
    );
    expect(isMessageDocument(roundTrippedFixture)).toBe(true);
  });
});

/**
 * Lists regular JSON Fixture files in deterministic code-unit order.
 *
 * @returns Sorted filenames directly inside the reviewed Fixture directory.
 */
async function listFixtureFileNames(): Promise<readonly string[]> {
  // Preserve directory entry types so nested directories, symlinks, and other
  // artifacts cannot become implicit conformance inputs.
  const entries = await fs.readdir(fixtureDirectory, { withFileTypes: true });

  // Relational comparison is stable across locales and supported hosts.
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort(compareFileNames);
}

/**
 * Reads and parses one constrained immediate-child Fixture file.
 *
 * @param fixtureFileName Filename returned by the reviewed directory scan.
 * @returns Parsed language-neutral JSON data without application coercion.
 */
async function readFixture(fixtureFileName: string): Promise<unknown> {
  // Joining only a scanned filename keeps reads in the dedicated directory and
  // preserves a precise filesystem failure when a committed file is absent.
  const fixturePath = path.join(fixtureDirectory, fixtureFileName);
  const source = await fs.readFile(fixturePath, "utf8");

  // Native parsing retains array order, newlines, emoji modifiers, composed and
  // decomposed accents, CJK text, and exact explicit JSON values.
  return JSON.parse(source) as unknown;
}

/** Creates an ordered snapshot from the deliberately flat conversation Fixture. */
function createMessageFixtureSnapshot(value: unknown): MessageFixtureSnapshot {
  const document = requireRecord(value, "MessageDocument");
  const root = requireRecord(document.root, "MessageDocument root");
  const children = requireArray(root.children, "MessageDocument root children");
  const entryIds: string[] = [];
  const roleIds: string[] = [];
  const contentIds: string[] = [];
  const texts: string[] = [];

  // Root children intentionally represent chronological turns directly. Reading
  // them in numeric index order detects any transport reordering immediately.
  for (const [entryIndex, entryValue] of children.entries()) {
    const entry = requireRecord(entryValue, `entry ${entryIndex}`);
    entryIds.push(requireString(entry.id, `entry ${entryIndex} id`));

    const role = requireRecord(entry.role, `entry ${entryIndex} role`);
    roleIds.push(requireString(role.id, `entry ${entryIndex} role id`));

    const content = requireArray(entry.content, `entry ${entryIndex} content`);
    // Content arrays retain their own order inside each chronological turn.
    for (const [contentIndex, contentValue] of content.entries()) {
      const item = requireRecord(contentValue, `entry ${entryIndex} content ${contentIndex}`);
      contentIds.push(requireString(item.id, `entry ${entryIndex} content ${contentIndex} id`));
      texts.push(requireString(item.text, `entry ${entryIndex} content ${contentIndex} text`));
    }
  }

  return { entryIds, roleIds, contentIds, texts };
}

/** Returns an object record or fails with the exact malformed Fixture location. */
function requireRecord(value: unknown, context: string): Record<string, unknown> {
  // Arrays are excluded because every inspected Fixture location is a named JSON
  // object whose members must be read explicitly by the snapshot logic.
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${context} to be an object.`);
  }
  return value as Record<string, unknown>;
}

/** Returns an array or fails with the exact malformed Fixture location. */
function requireArray(value: unknown, context: string): readonly unknown[] {
  // The snapshot never coerces iterables or array-like objects because JSON
  // ordering guarantees apply specifically to concrete arrays.
  if (!Array.isArray(value)) {
    throw new TypeError(`Expected ${context} to be an array.`);
  }
  return value;
}

/** Returns a string or fails with the exact malformed Fixture location. */
function requireString(value: unknown, context: string): string {
  // Exact strings are returned without trimming or Unicode normalization so the
  // test can detect any change in whitespace or code-point representation.
  if (typeof value !== "string") {
    throw new TypeError(`Expected ${context} to be a string.`);
  }
  return value;
}

/**
 * Compares filenames with deterministic UTF-16 code-unit semantics.
 *
 * @param left First filename.
 * @param right Second filename.
 * @returns Negative, zero, or positive ordering result.
 */
function compareFileNames(left: string, right: string): number {
  // Avoid locale collation so every supported host sees the same sequence.
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
