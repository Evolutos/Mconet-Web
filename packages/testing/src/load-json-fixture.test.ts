// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, expectTypeOf, it } from "vitest";

import { loadJsonFixture } from "./load-json-fixture.js";

/** Stable committed Fixture used to prove module-relative loading. */
const durationFixtureUrl = new URL("../../../spec/fixtures/base/duration.json", import.meta.url);

it("loads one committed Fixture relative to the calling module", async () => {
  const fixture = await loadJsonFixture(durationFixtureUrl);

  // Exact data proves the loader resolves from the supplied module URL, reads
  // UTF-8 JSON, and preserves every numeric boundary without coercion.
  expect(fixture).toEqual({
    kind: "duration",
    cases: [{ milliseconds: 0 }, { milliseconds: 250 }, { milliseconds: 9007199254740991 }],
  });
  expectTypeOf(fixture).toEqualTypeOf<unknown>();
});

it("returns a freshly parsed object for every load", async () => {
  const first = await loadJsonFixture(durationFixtureUrl);
  const second = await loadJsonFixture(durationFixtureUrl);

  // Equal-but-distinct roots prove the utility has no shared mutable cache that
  // could leak a test's Fixture mutation into later tests.
  expect(first).toEqual(second);
  expect(first).not.toBe(second);
});

it("rejects non-URL input at the runtime boundary", async () => {
  // Compile-time and runtime checks jointly protect TypeScript and JavaScript
  // consumers while the assertion deliberately exercises the latter boundary.
  // @ts-expect-error Runtime validation must reject untyped JavaScript input.
  await expect(loadJsonFixture(durationFixtureUrl.href)).rejects.toThrow(
    new TypeError("Fixture URL must be a URL instance."),
  );
});

it("rejects non-local URLs before performing I/O", async () => {
  const remoteFixtureUrl = new URL("https://fixtures.invalid/duration.json");

  // A Fixture loader cannot introduce network timing, redirects, credentials,
  // or remote content changes into deterministic tests.
  await expect(loadJsonFixture(remoteFixtureUrl)).rejects.toThrow(
    new TypeError("Fixture URL must use the 'file:' protocol."),
  );
});

it("rejects URL qualifiers and non-JSON filenames", async () => {
  const queriedFixtureUrl = new URL(durationFixtureUrl);
  queriedFixtureUrl.search = "?revision=2";
  const fragmentedFixtureUrl = new URL(durationFixtureUrl);
  fragmentedFixtureUrl.hash = "#case-1";
  const sourceFileUrl = new URL("./load-json-fixture.ts", import.meta.url);

  // Queries and fragments are not filesystem identity, while an exact extension
  // keeps executable source and unrelated artifacts outside Fixture loading.
  await expect(loadJsonFixture(queriedFixtureUrl)).rejects.toThrow(
    new TypeError("Fixture URL must not contain a query or fragment."),
  );
  await expect(loadJsonFixture(fragmentedFixtureUrl)).rejects.toThrow(
    new TypeError("Fixture URL must not contain a query or fragment."),
  );
  await expect(loadJsonFixture(sourceFileUrl)).rejects.toThrow(
    new TypeError("Fixture URL must identify a file ending in '.json'."),
  );
});

it("preserves a filesystem failure as the read error cause", async () => {
  const missingFixtureUrl = new URL("./missing-fixture.json", import.meta.url);

  // Stable operation context identifies the failed Fixture while the native
  // cause retains the filesystem error code required for low-level diagnosis.
  await expect(loadJsonFixture(missingFixtureUrl)).rejects.toMatchObject({
    message: expect.stringContaining("Unable to read Fixture"),
    cause: { code: "ENOENT" },
  });
});

it("reports invalid JSON with the native parser error as cause", async () => {
  // Use a test-owned temporary directory so the repository never carries an
  // intentionally malformed JSON artifact that would break formatting tools.
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "mconet-fixture-loader-"));
  const malformedFixturePath = path.join(temporaryDirectory, "malformed.json");

  try {
    await fs.writeFile(malformedFixturePath, '{"missingValue":}', "utf8");

    await expect(loadJsonFixture(pathToFileURL(malformedFixturePath))).rejects.toMatchObject({
      name: "SyntaxError",
      message: `Fixture '${malformedFixturePath}' is not valid JSON.`,
      cause: expect.any(SyntaxError),
    });
  } finally {
    // Always remove the test-owned directory, including when parsing or an
    // assertion fails, so local and CI runs leave no Fixture state behind.
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});
