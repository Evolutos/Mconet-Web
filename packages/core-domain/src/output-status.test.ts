// Copyright © 2026 Mcont.

import { expect, expectTypeOf, it } from "vitest";

import type { OutputStatus } from "./output-status.js";

/** Standard output states defined by the language-neutral architecture. */
const standardOutputStatuses = [
  "completed",
  "requires_action",
  "incomplete",
  "refused",
  "filtered",
  "cancelled",
  "failed",
  "unknown",
] as const satisfies readonly OutputStatus[];

it("includes every standard output status as a literal", () => {
  // Extract the standard branch to prove all documented identities remain
  // represented explicitly rather than relying only on broad string support.
  expectTypeOf<Extract<OutputStatus, (typeof standardOutputStatuses)[number]>>().toEqualTypeOf<
    (typeof standardOutputStatuses)[number]
  >();

  // Guard the reviewed vocabulary and declaration order with a runtime value.
  expect(standardOutputStatuses).toEqual([
    "completed",
    "requires_action",
    "incomplete",
    "refused",
    "filtered",
    "cancelled",
    "failed",
    "unknown",
  ]);
});

it("preserves integration-defined and future output statuses", () => {
  const integrationStatus = "provider.awaiting_review";
  const dynamicStatus: string = integrationStatus;
  const statuses: readonly OutputStatus[] = [integrationStatus, dynamicStatus];

  // Both literal and runtime strings remain exact open values; neither becomes
  // the standard `unknown` status or requires a Core vocabulary update.
  expectTypeOf<string>().toMatchTypeOf<OutputStatus>();
  expect(statuses).toEqual(["provider.awaiting_review", "provider.awaiting_review"]);
  expect(statuses).not.toContain("unknown");
});

it("keeps lifecycle and result information outside status identity", () => {
  // Wrapper objects would absorb independently owned result, reason, diagnostics,
  // error, or protocol state and therefore cannot replace the string identity.
  expectTypeOf<{ readonly status: string }>().not.toMatchTypeOf<OutputStatus>();
  expectTypeOf<{ readonly id: string }>().not.toMatchTypeOf<OutputStatus>();
  expectTypeOf<{ readonly result: unknown }>().not.toMatchTypeOf<OutputStatus>();
});

it("rejects non-string status representations", () => {
  // Numeric flags, booleans, null sentinels, arrays, and symbols are not portable
  // open identifiers at the public TypeScript boundary.
  expectTypeOf<number>().not.toMatchTypeOf<OutputStatus>();
  expectTypeOf<boolean>().not.toMatchTypeOf<OutputStatus>();
  expectTypeOf<null>().not.toMatchTypeOf<OutputStatus>();
  expectTypeOf<readonly string[]>().not.toMatchTypeOf<OutputStatus>();
  expectTypeOf<symbol>().not.toMatchTypeOf<OutputStatus>();
});
