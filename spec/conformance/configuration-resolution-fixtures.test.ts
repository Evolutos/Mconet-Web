// Copyright © 2026 Mcont.

import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import type {
  CompatibilityMode,
  CompatibilityPolicy,
  InteractionResourceLimits,
  ModelTarget,
  ResolvedInteractionResourceLimits,
  ServiceAccess,
} from "../../packages/core-domain/src/index.js";
import { mergeInteractionConfiguration } from "../../packages/core-runtime/src/merge-interaction-configuration.js";
import { areJsonValuesCanonicallyEqual } from "../../packages/testing/src/canonical-json-comparator.js";

/** Single committed configuration-precedence Fixture. */
const fixturePath = fileURLToPath(
  new URL("../fixtures/configuration-resolution/precedence.json", import.meta.url),
);

/** Resource-limit fields resolved independently by the production merger. */
const resourceLimitFieldNames = [
  "maxResponseBodyBytes",
  "maxStreamingErrorBodyBytes",
  "maxFrameBytes",
] as const;

/** Parsed Fixture reused by every configuration-resolution conformance case. */
let fixture: ConfigurationResolutionFixture;

beforeAll(async () => {
  // Parse the committed JSON once. Every test then consumes its own case array
  // without mutating the language-neutral source data.
  fixture = await readFixture();
});

describe("configuration resolution Fixture", () => {
  // Exercise exact branch inventory, target and access identity selection,
  // compatibility provenance, and independent resource-limit provenance.
  it("declares the complete reviewed branch inventory and round-trips canonically", () => {
    // Exact case identifiers keep every precedence branch reviewable and prevent
    // silent removal or insertion of a partial scenario.
    expect(fixture.targetCases.map(({ id }) => id)).toEqual([
      "request-over-client",
      "client-fallback",
    ]);
    expect(fixture.serviceAccessCases.map(({ id }) => id)).toEqual([
      "interaction-over-all",
      "request-fallback",
      "client-fallback",
      "integration-fallback",
      "complete-absence",
    ]);
    expect(fixture.compatibilityCases.map(({ id }) => id)).toEqual([
      "interaction-over-client",
      "client-fallback",
      "sdk-default",
    ]);
    expect(fixture.resourceLimitCases.map(({ id }) => id)).toEqual([
      "interaction-over-all",
      "client-fallback",
      "sdk-fallback",
      "mixed-per-field",
    ]);

    // A fresh JSON encoding must retain every source label, expected value, and
    // case order used to trace production resolution.
    const roundTrippedFixture = JSON.parse(JSON.stringify(fixture)) as unknown;
    expect(areJsonValuesCanonicallyEqual(fixture, roundTrippedFixture)).toBe(true);
  });

  it("traces both target priority branches by selected identity", () => {
    for (const testCase of fixture.targetCases) {
      const requestTarget = targetFor(testCase.requestSource);
      const clientTarget = targetFor(testCase.clientSource);
      const resolved = mergeInteractionConfiguration({
        ...baseInput(),
        requestTarget,
        clientConfiguration: clientTarget === undefined ? {} : { defaultTarget: clientTarget },
      });

      // Identity proves the merger selected one declared source rather than
      // synthesizing or combining target data.
      expect(resolved.target, testCase.id).toBe(targetFor(testCase.expectedSource));
    }
  });

  it("traces all service-access tiers and complete absence by identity", () => {
    for (const testCase of fixture.serviceAccessCases) {
      const interactionAccess = accessFor(testCase.interactionSource);
      const requestAccess = accessFor(testCase.requestSource);
      const clientAccess = accessFor(testCase.clientSource);
      const integrationAccess = accessFor(testCase.integrationSource);
      const resolved = mergeInteractionConfiguration({
        ...baseInput(),
        requestServiceAccess: requestAccess,
        clientConfiguration:
          clientAccess === undefined ? {} : { defaultServiceAccess: clientAccess },
        interactionOptions:
          interactionAccess === undefined ? {} : { serviceAccessOverride: interactionAccess },
        integrationServiceAccess: integrationAccess,
      });

      // Whole-object access selection must preserve the winning source identity;
      // the all-null case must retain explicit undefined.
      expect(resolved.serviceAccess, testCase.id).toBe(accessFor(testCase.expectedSource));
    }
  });

  it("traces interaction, client, and SDK compatibility sources", () => {
    for (const testCase of fixture.compatibilityCases) {
      const interactionPolicy = policyFor(testCase.interactionMode);
      const clientPolicy = policyFor(testCase.clientMode);
      const resolved = mergeInteractionConfiguration({
        ...baseInput(),
        clientConfiguration:
          clientPolicy === undefined ? {} : { defaultCompatibilityPolicy: clientPolicy },
        interactionOptions:
          interactionPolicy === undefined ? {} : { compatibilityPolicy: interactionPolicy },
      });

      expect(resolved.compatibilityPolicy.mode, testCase.id).toBe(testCase.expectedMode);
      if (testCase.expectedSource === "interaction") {
        expect(resolved.compatibilityPolicy, testCase.id).toBe(interactionPolicy);
      } else if (testCase.expectedSource === "client") {
        expect(resolved.compatibilityPolicy, testCase.id).toBe(clientPolicy);
      } else {
        // SDK fallback is freshly allocated and frozen rather than shared with a
        // caller-owned source policy.
        expect(Object.isFrozen(resolved.compatibilityPolicy), testCase.id).toBe(true);
      }
    }
  });

  it("traces every resource-limit field to its winning source", () => {
    for (const testCase of fixture.resourceLimitCases) {
      const resolved = mergeInteractionConfiguration({
        ...baseInput(),
        sdkResourceLimits: testCase.sdk,
        clientConfiguration:
          testCase.client === null ? {} : { defaultResourceLimits: testCase.client },
        interactionOptions:
          testCase.interaction === null ? {} : { resourceLimits: testCase.interaction },
      });

      // Compare the complete production result first, then prove each expected
      // number is exactly the value declared at its traced source layer.
      expect(resolved.resourceLimits, testCase.id).toEqual(testCase.expected);
      for (const fieldName of resourceLimitFieldNames) {
        const expectedSource = testCase.expectedSources[fieldName];
        expect(testCase.expected[fieldName], `${testCase.id}:${fieldName}`).toBe(
          resourceValueFrom(testCase, expectedSource, fieldName),
        );
      }
    }
  });
});

/**
 * Creates the invariant inputs unrelated to the dimension under test.
 *
 * @returns Fresh explicit merger input with a request target and finite defaults.
 */
function baseInput(): Parameters<typeof mergeInteractionConfiguration>[0] {
  // Allocate only the outer input. Shared immutable source identities below are
  // intentional because selection tests rely on reference equality.
  return {
    requestTarget: targets.request,
    requestServiceAccess: undefined,
    clientConfiguration: {},
    interactionOptions: {},
    integrationServiceAccess: undefined,
    sdkResourceLimits: {
      maxResponseBodyBytes: 100,
      maxStreamingErrorBodyBytes: 200,
      maxFrameBytes: 300,
    },
  };
}

/** Stable target identities referenced by Fixture source labels. */
const targets = Object.freeze({
  request: createTarget("request"),
  client: createTarget("client"),
});

/**
 * Creates one immutable target carrying its source label in every identity.
 *
 * @param source Source name represented by the target.
 * @returns Frozen ModelTarget used only for precedence identity checks.
 */
function createTarget(source: TargetSource): ModelTarget {
  // Freeze nested and outer values so conformance execution cannot rewrite a
  // source while another Fixture case still references it.
  const model = Object.freeze({
    name: `${source}-model`,
    metadata: Object.freeze({}),
    extensions: Object.freeze({}),
  });
  return Object.freeze({
    serviceId: `service.${source}`,
    protocolId: `protocol.${source}`,
    model,
    extensions: Object.freeze({}),
  });
}

/**
 * Resolves an optional Fixture target label to its stable source object.
 *
 * @param source Target label or explicit absence.
 * @returns Corresponding target identity or undefined.
 */
function targetFor(source: TargetSource | null): ModelTarget | undefined {
  // Null is the language-neutral absence marker; every non-null label indexes a
  // closed reviewed map.
  return source === null ? undefined : targets[source];
}

/** Stable service-access identities referenced by Fixture source labels. */
const accessBySource = Object.freeze({
  interaction: createAccess("interaction"),
  request: createAccess("request"),
  client: createAccess("client"),
  integration: createAccess("integration"),
});

/**
 * Creates one frozen ServiceAccess source with a trace-only non-sensitive header.
 *
 * @param source Source label to preserve in the header value.
 * @returns Frozen access object used for whole-object identity checks.
 */
function createAccess(source: AccessSource): ServiceAccess {
  // Retain the source label in ordinary non-sensitive data while freezing every
  // container involved in identity selection.
  return Object.freeze({
    headers: Object.freeze([Object.freeze({ name: "x-source", value: source })]),
    query: Object.freeze([]),
    extensions: Object.freeze({}),
  });
}

/**
 * Resolves an optional access label to its stable source identity.
 *
 * @param source Access label or explicit absence.
 * @returns Corresponding ServiceAccess object or undefined.
 */
function accessFor(source: AccessSource | null): ServiceAccess | undefined {
  // Preserve explicit absence rather than allocating an empty access object.
  return source === null ? undefined : accessBySource[source];
}

/** Stable caller-owned compatibility policies keyed by mode. */
const policies = Object.freeze({
  strict: Object.freeze({ mode: "strict" }),
  permissive: Object.freeze({ mode: "permissive" }),
} satisfies Readonly<Record<CallerCompatibilityMode, CompatibilityPolicy>>);

/**
 * Resolves an optional Fixture mode to a stable caller-owned policy.
 *
 * @param mode Caller-supplied compatibility mode or explicit absence.
 * @returns Matching policy identity or undefined for SDK fallback.
 */
function policyFor(mode: CallerCompatibilityMode | null): CompatibilityPolicy | undefined {
  // Only caller modes appear in this map; compatible is produced by the SDK
  // default factory and therefore cannot be selected as a caller source here.
  return mode === null ? undefined : policies[mode];
}

/**
 * Reads the expected resource-limit value from its declared source layer.
 *
 * @param testCase Fixture case containing all source layers.
 * @param source Winning source declared for one field.
 * @param fieldName Resource-limit field being traced.
 * @returns Positive integer declared at the winning layer.
 */
function resourceValueFrom(
  testCase: ResourceLimitCase,
  source: ResourceLimitSource,
  fieldName: ResourceLimitFieldName,
): number {
  const layer = source === "sdk" ? testCase.sdk : testCase[source];
  const value = layer?.[fieldName];

  // A trace pointing at an absent layer or field makes the Fixture internally
  // inconsistent and must fail independently from the production result.
  if (value === undefined) {
    throw new Error(
      `Fixture case '${testCase.id}' traces '${fieldName}' to missing source '${source}'.`,
    );
  }
  return value;
}

/**
 * Reads the committed configuration-resolution Fixture.
 *
 * @returns Parsed case collections consumed by the production merger.
 */
async function readFixture(): Promise<ConfigurationResolutionFixture> {
  const source = await fs.readFile(fixturePath, "utf8");

  // The cases are executed exhaustively below; missing or malformed members
  // fail through exact inventories, indexed maps, or production validation.
  return JSON.parse(source) as ConfigurationResolutionFixture;
}

type TargetSource = "request" | "client";
type AccessSource = "interaction" | "request" | "client" | "integration";
type CallerCompatibilityMode = "strict" | "permissive";
type CompatibilitySource = "interaction" | "client" | "sdk";
type ResourceLimitSource = "interaction" | "client" | "sdk";
type ResourceLimitFieldName = (typeof resourceLimitFieldNames)[number];

type TargetCase = Readonly<{
  id: string;
  requestSource: TargetSource | null;
  clientSource: "client";
  expectedSource: TargetSource;
}>;

type ServiceAccessCase = Readonly<{
  id: string;
  interactionSource: "interaction" | null;
  requestSource: "request" | null;
  clientSource: "client" | null;
  integrationSource: "integration" | null;
  expectedSource: AccessSource | null;
}>;

type CompatibilityCase = Readonly<{
  id: string;
  interactionMode: "strict" | null;
  clientMode: "permissive" | null;
  expectedMode: CompatibilityMode;
  expectedSource: CompatibilitySource;
}>;

type ResourceLimitCase = Readonly<{
  id: string;
  sdk: ResolvedInteractionResourceLimits;
  client: InteractionResourceLimits | null;
  interaction: InteractionResourceLimits | null;
  expected: ResolvedInteractionResourceLimits;
  expectedSources: Readonly<Record<ResourceLimitFieldName, ResourceLimitSource>>;
}>;

type ConfigurationResolutionFixture = Readonly<{
  targetCases: readonly TargetCase[];
  serviceAccessCases: readonly ServiceAccessCase[];
  compatibilityCases: readonly CompatibilityCase[];
  resourceLimitCases: readonly ResourceLimitCase[];
}>;
