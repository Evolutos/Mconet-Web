// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { JsonPayloadEncoder } from "../../packages/codec-json/src/json-payload-encoder.js";
import { JsonSuccessPayloadDecoder } from "../../packages/codec-json/src/json-success-payload-decoder.js";
import type { ErasedRuntimeValue } from "../../packages/core-spi/src/index.js";

/** Reviewed golden fixture for deterministic JSON codec output. */
const goldenFixturePath = fileURLToPath(
  new URL("../fixtures/json-payload/golden.json", import.meta.url),
);

/** Directory whose only reviewed artifact is the golden fixture. */
const goldenFixtureDirectory = fileURLToPath(new URL("../fixtures/json-payload/", import.meta.url));

/** Byte limit large enough for every reviewed golden body. */
const maximumGoldenBodyBytes = 256;

/** One reviewed input value and the exact JSON text the codec must produce. */
interface GoldenCase {
  readonly value: unknown;
  readonly json: string;
}

it("keeps JSON codec output identical to the reviewed golden fixture", async () => {
  const fixtureNames = (await fs.readdir(goldenFixtureDirectory)).sort(compareFileNames);
  // An extra or missing file would make this report describe a different fixture set.
  expect(fixtureNames).toEqual(["golden.json"]);

  const cases = await readGoldenCases();
  const encoder = new JsonPayloadEncoder();
  const decoder = new JsonSuccessPayloadDecoder(maximumGoldenBodyBytes);
  const signal = new AbortController().signal;

  for (const goldenCase of cases) {
    const payload: ErasedRuntimeValue = { typeId: "json.value", value: goldenCase.value };
    const first = await encoder.encode(payload, { signal });
    const second = await encoder.encode(payload, { signal });
    const firstText = new TextDecoder().decode(first.bytes);
    const secondText = new TextDecoder().decode(second.bytes);

    // Both encodings match the reviewed text, so key order and spacing cannot drift.
    expect(firstText).toBe(goldenCase.json);
    expect(secondText).toBe(goldenCase.json);
    expect(second.bytes).toEqual(first.bytes);
    expect(second.bytes).not.toBe(first.bytes);

    const decoded = await decoder.decode(new TextEncoder().encode(goldenCase.json), { signal });
    expect(decoded).toEqual({ typeId: "json.value", value: goldenCase.value });
  }
});

/**
 * Reads the reviewed golden cases without rebuilding their expected text.
 *
 * @returns Fixture cases in file order.
 */
async function readGoldenCases(): Promise<readonly GoldenCase[]> {
  const parsed: unknown = JSON.parse(await fs.readFile(goldenFixturePath, "utf8"));
  if (!isRecord(parsed) || parsed.kind !== "json-payload-golden" || !Array.isArray(parsed.cases)) {
    throw new Error("JSON golden fixture is not the expected document.");
  }

  return parsed.cases.map((entry) => {
    if (!isRecord(entry) || typeof entry.json !== "string" || !("value" in entry)) {
      throw new Error("JSON golden fixture case is missing its value or JSON text.");
    }
    return { value: entry.value, json: entry.json };
  });
}

/**
 * Compares fixture names by UTF-16 code units.
 *
 * @param left First filename.
 * @param right Second filename.
 * @returns Negative, zero, or positive comparison result.
 */
function compareFileNames(left: string, right: string): number {
  // Relational comparison is stable across host locales.
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

/**
 * Narrows one parsed JSON value to a string-keyed record.
 *
 * @param value Parsed fixture value.
 * @returns Whether the value is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
