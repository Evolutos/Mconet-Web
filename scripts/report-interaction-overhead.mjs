// Copyright © 2026 Mcont.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { TextEncoder } from "node:util";
import { fileURLToPath } from "node:url";

import { createDefaultClient } from "../packages/client/dist/node.js";

/** Workspace root resolved independently from the caller's current directory. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Frozen median ceiling for one in-memory interaction.
 *
 * S0 did not publish a millisecond budget. The transport returns immediately,
 * so the median is SDK overhead. The measured median is about 0.055 ms. The
 * ceiling is 2 ms so a slower runner can pass and a path that waits on I/O
 * cannot.
 */
const baselinePath = path.join(workspaceRoot, "spec", "interaction-overhead-baseline.json");

/** Generated release report. The directory is not committed. */
const reportPath = path.join(workspaceRoot, ".artifacts", "reports", "interaction-overhead.json");

/** Interactions discarded before sampling. */
const warmupInteractions = 20;

/** Independent timed batches. The median batch absorbs a single slow sample. */
const rounds = 20;

/** Interactions inside one timed batch. */
const interactionsPerRound = 25;

/** JSON media type shared by the plan, the transport, and the decoder. */
const json = { type: "application", subtype: "json", parameters: {} };

/** Body the in-memory transport returns. The adapter accepts `{ ok: true }`. */
const responseBody = new TextEncoder().encode('{"ok":true}');

/**
 * Transport that completes without a network call.
 *
 * Its port matches the JSON codecs. Time spent here is one resolved promise,
 * which is part of the SDK's asynchronous interaction path.
 */
const transport = {
  descriptor: {
    name: "benchmark-transport",
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
    typeContract: {
      inputTypeId: "codec.bytes",
      outputTypeId: "codec.bytes",
      outputMediaTypes: [json],
    },
  },
  send() {
    return Promise.resolve({
      metadata: { outcome: "success", headers: [], extensions: {}, mediaType: json },
      body: responseBody,
    });
  },
};

/** Plan the adapter returns. It names JSON codecs and no extra authorization. */
const plan = {
  transportPlan: {
    endpoint: { kind: "absolute", value: "https://example.test" },
    path: "/chat/completions",
    method: "POST",
    headers: [],
    query: [],
    authorization: { kind: "authorization.none" },
    transportExtensions: {},
  },
  payloadEncoder: { mediaType: json },
  successDecoder: { mediaType: json },
  errorDecoder: { mediaType: json },
  transport: { requiredCapabilities: new Set() },
  modeComponents: [],
  typeContract: {
    inputTypeId: "json.value",
    outputTypeId: "json.value",
    inputMediaTypes: [json],
    outputMediaTypes: [json],
  },
  extensions: {},
};

/**
 * Adapter that turns the fixed request into the fixed JSON payload.
 *
 * Parsing accepts only the benchmark body, so a transport that returns
 * something else fails the sample instead of looking fast.
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
    return { diagnostics: [], value: plan };
  },
  buildRequest() {
    return {
      diagnostics: [],
      value: {
        payload: { typeId: "json.value", value: { ok: true } },
        executionPlan: plan,
      },
    };
  },
  parseResponse({ payload }) {
    if (payload.typeId !== "json.value" || payload.value?.ok !== true) {
      throw new Error("Interaction overhead benchmark received an unexpected payload.");
    }
    return {
      diagnostics: [],
      value: {
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
        protocolState: [],
        extensions: {},
      },
    };
  },
  parseError() {
    throw new Error("Interaction overhead benchmark does not parse an error.");
  },
};

/** Request envelope reused by every sample. The runtime must not require a new one. */
const request = {
  target: {
    serviceId: "service.vendor",
    protocolId: "protocol.vendor",
    model: { name: "vendor-model", metadata: {}, extensions: {} },
    extensions: {},
  },
  task: {
    descriptor: { type: "conversation.generate", metadata: {}, extensions: {} },
    document: {
      version: "1.0",
      root: {
        id: "task-root",
        kind: "task.root",
        composition: "container",
        children: [
          {
            id: "conversation-input",
            kind: "task.input.conversation",
            composition: "leaf",
            messages: {
              version: "1.0",
              purpose: "input",
              root: {
                id: "message-root",
                kind: "message.root",
                composition: "container",
                children: [],
                relations: [],
                metadata: {},
                extensions: {},
              },
              metadata: {},
              extensions: {},
            },
            relations: [],
            metadata: {},
            extensions: {},
          },
        ],
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
  serviceAccess: {
    endpoint: { kind: "absolute", value: "https://example.test" },
    authorization: { kind: "authorization.none" },
    headers: [],
    query: [],
    extensions: {},
  },
  metadata: {},
  extensions: {},
};

/**
 * Rejects a median that exceeds the frozen ceiling.
 *
 * @param {number} medianMilliseconds Median milliseconds per interaction.
 * @param {number} maxMedianMilliseconds Frozen ceiling.
 */
export function assertInteractionBudget(medianMilliseconds, maxMedianMilliseconds) {
  if (!Number.isFinite(medianMilliseconds) || medianMilliseconds < 0) {
    throw new Error("Interaction overhead benchmark did not record a median.");
  }
  if (!Number.isFinite(maxMedianMilliseconds) || maxMedianMilliseconds <= 0) {
    throw new Error("The interaction overhead baseline has no positive ceiling.");
  }
  if (medianMilliseconds > maxMedianMilliseconds) {
    throw new Error(
      `Interaction overhead median is ${medianMilliseconds} ms, above ${maxMedianMilliseconds} ms.`,
    );
  }
}

/**
 * Samples the median milliseconds of one completed interaction.
 *
 * The client and the request are created outside the timer. The sample is the
 * cost of running the unary path against an already resolved transport.
 *
 * @returns {Promise<number>} Median milliseconds per interaction.
 */
async function measureMedianMilliseconds() {
  const client = createDefaultClient({
    adapter,
    components: { transport },
  });
  for (let index = 0; index < warmupInteractions; index += 1) {
    const output = await client.interact(request);
    if (output.status !== "completed") {
      throw new Error("Interaction overhead benchmark did not complete.");
    }
  }
  /** @type {number[]} */
  const samples = [];
  for (let round = 0; round < rounds; round += 1) {
    const started = performance.now();
    for (let index = 0; index < interactionsPerRound; index += 1) {
      const output = await client.interact(request);
      if (output.status !== "completed") {
        throw new Error("Interaction overhead benchmark did not complete.");
      }
    }
    samples.push((performance.now() - started) / interactionsPerRound);
  }
  samples.sort((left, right) => left - right);
  const median = samples[Math.floor(samples.length / 2)];
  if (median === undefined) {
    throw new Error("Interaction overhead benchmark did not record a sample.");
  }
  return median;
}

/** Reads the frozen ceiling. */
async function readMaxMedianMilliseconds() {
  const parsed = JSON.parse(await readFile(baselinePath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("The interaction overhead baseline is not an object.");
  }
  return parsed.maxMedianMilliseconds;
}

/** Measures one interaction and writes the release report. */
async function reportInteractionOverhead() {
  const maxMedianMilliseconds = await readMaxMedianMilliseconds();
  const medianMilliseconds = await measureMedianMilliseconds();
  assertInteractionBudget(medianMilliseconds, maxMedianMilliseconds);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        suite: "interaction-overhead",
        medianMilliseconds,
        maxMedianMilliseconds,
        interactionsPerRound,
        rounds,
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(
    `Interaction overhead report: median ${medianMilliseconds} ms, ceiling ${maxMedianMilliseconds} ms.\n`,
  );
}

/** Proves the ceiling check without measuring. */
function selfTestInteractionOverhead() {
  assertInteractionBudget(2, 2);
  let rejected = false;
  try {
    assertInteractionBudget(2.1, 2);
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("above 2 ms");
  }
  if (!rejected) {
    throw new Error("Interaction overhead self-test failed to reject a slow median.");
  }
  process.stdout.write("Interaction overhead self-test passed.\n");
}

/** Parses command arguments and runs either the benchmark or its self-test. */
async function main() {
  const [argument, ...unexpectedArguments] = process.argv.slice(2);
  if (unexpectedArguments.length > 0 || (argument && argument !== "--self-test")) {
    throw new Error("Usage: node scripts/report-interaction-overhead.mjs [--self-test]");
  }
  if (argument === "--self-test") {
    selfTestInteractionOverhead();
    return;
  }
  await reportInteractionOverhead();
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
