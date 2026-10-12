// Copyright © 2026 Mcont.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createDefaultClient } from "../packages/client/dist/node.js";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Frozen median ceiling for one default client construction.
 *
 * S0 did not publish a millisecond budget. The measured median on this SDK is
 * about 0.001 ms. The ceiling is 0.25 ms so a slower runner can pass and a
 * creation path that starts doing I/O cannot.
 */
const baselinePath = path.join(workspaceRoot, "spec", "client-creation-baseline.json");

/** Generated release report. The directory is not committed. */
const reportPath = path.join(workspaceRoot, ".artifacts", "reports", "client-creation.json");

/** Constructions discarded before sampling so the first calls are not the median. */
const warmupCreations = 50;

/** Independent timed batches. The median batch absorbs a single slow sample. */
const rounds = 20;

/** Constructions inside one timed batch. */
const creationsPerRound = 100;

/**
 * Adapter that satisfies the construction role check.
 *
 * Creation only reads `descriptor` and `supports`. The other methods exist so
 * the object is a complete adapter if a later call inspects them.
 */
const adapter = {
  descriptor: {
    name: "benchmark-adapter",
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
  },
  supports() {
    return true;
  },
  preparePlan() {
    throw new Error("Client creation benchmark does not prepare a plan.");
  },
  buildRequest() {
    throw new Error("Client creation benchmark does not build a request.");
  },
  parseResponse() {
    throw new Error("Client creation benchmark does not parse a response.");
  },
  parseError() {
    throw new Error("Client creation benchmark does not parse an error.");
  },
};

/**
 * Rejects a median that exceeds the frozen ceiling.
 *
 * @param {number} medianMilliseconds Median milliseconds per construction.
 * @param {number} maxMedianMilliseconds Frozen ceiling.
 */
export function assertCreationBudget(medianMilliseconds, maxMedianMilliseconds) {
  if (!Number.isFinite(medianMilliseconds) || medianMilliseconds < 0) {
    throw new Error("Client creation benchmark did not record a median.");
  }
  if (!Number.isFinite(maxMedianMilliseconds) || maxMedianMilliseconds <= 0) {
    throw new Error("The client creation baseline has no positive ceiling.");
  }
  if (medianMilliseconds > maxMedianMilliseconds) {
    throw new Error(
      `Client creation median is ${medianMilliseconds} ms, above ${maxMedianMilliseconds} ms.`,
    );
  }
}

/** Builds one default Node client. The transport is the real Node Fetch default. */
function createClient() {
  return createDefaultClient({ adapter });
}

/**
 * Samples the median milliseconds of one construction.
 *
 * Each sample is a batch average. Timing every call would measure the clock
 * more than the constructor.
 *
 * @returns {number} Median milliseconds per construction.
 */
function measureMedianMilliseconds() {
  const probe = createClient();
  if (typeof probe.interact !== "function") {
    throw new Error("Client creation benchmark did not receive a client.");
  }
  for (let index = 0; index < warmupCreations; index += 1) {
    createClient();
  }
  /** @type {number[]} */
  const samples = [];
  // The array keeps each client alive until the batch is timed, so the
  // constructor cannot be removed as an unused call.
  /** @type {unknown[]} */
  const created = [];
  for (let round = 0; round < rounds; round += 1) {
    created.length = 0;
    const started = performance.now();
    for (let index = 0; index < creationsPerRound; index += 1) {
      created.push(createClient());
    }
    const elapsed = performance.now() - started;
    if (created.length !== creationsPerRound) {
      throw new Error("Client creation benchmark dropped a constructed client.");
    }
    samples.push(elapsed / creationsPerRound);
  }
  samples.sort((left, right) => left - right);
  const median = samples[Math.floor(samples.length / 2)];
  if (median === undefined) {
    throw new Error("Client creation benchmark did not record a sample.");
  }
  return median;
}

/** Reads the frozen ceiling. */
async function readMaxMedianMilliseconds() {
  const parsed = JSON.parse(await readFile(baselinePath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("The client creation baseline is not an object.");
  }
  return parsed.maxMedianMilliseconds;
}

/** Measures client creation and writes the release report. */
async function reportClientCreation() {
  const maxMedianMilliseconds = await readMaxMedianMilliseconds();
  const medianMilliseconds = measureMedianMilliseconds();
  assertCreationBudget(medianMilliseconds, maxMedianMilliseconds);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        suite: "client-creation",
        medianMilliseconds,
        maxMedianMilliseconds,
        creationsPerRound,
        rounds,
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(
    `Client creation report: median ${medianMilliseconds} ms, ceiling ${maxMedianMilliseconds} ms.\n`,
  );
}

/** Proves the ceiling check without measuring. */
function selfTestClientCreation() {
  assertCreationBudget(1, 1);
  let rejected = false;
  try {
    assertCreationBudget(1.1, 1);
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("above 1 ms");
  }
  if (!rejected) {
    throw new Error("Client creation self-test failed to reject a slow median.");
  }
  process.stdout.write("Client creation self-test passed.\n");
}

/** Parses command arguments and runs either the benchmark or its self-test. */
async function main() {
  const [argument, ...unexpectedArguments] = process.argv.slice(2);
  if (unexpectedArguments.length > 0 || (argument && argument !== "--self-test")) {
    throw new Error("Usage: node scripts/report-client-creation.mjs [--self-test]");
  }
  if (argument === "--self-test") {
    selfTestClientCreation();
    return;
  }
  await reportClientCreation();
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
