// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { mapFetchAbortError } from "./map-fetch-abort-error.js";

/** Text that must not be copied from an abort reason. */
const secretReasonText = "abort-secret-value";

it("maps a timeout reason to a timeout error", () => {
  const caller = new AbortController();
  caller.abort(new DOMException(`deadline ${secretReasonText}`, "TimeoutError"));

  const error = mapFetchAbortError(caller.signal);

  expect(error).toMatchObject({
    category: "timeout",
    phase: "transport",
    code: "timeout",
    message: "The Fetch deadline expired.",
  });
  expect(error.cause).toBeUndefined();
  expect(String(error)).not.toContain(secretReasonText);
  expect(JSON.stringify(error)).not.toContain(secretReasonText);
});

it("maps any other abort reason to caller cancellation", () => {
  const caller = new AbortController();
  caller.abort(new Error(secretReasonText));

  const error = mapFetchAbortError(caller.signal);

  expect(error).toMatchObject({
    category: "cancelled",
    phase: "transport",
    code: "cancelled",
    message: "The Fetch request was cancelled.",
  });
  expect(error.cause).toBeUndefined();
  expect(String(error)).not.toContain(secretReasonText);
});

it("maps the platform abort reason to cancellation rather than timeout", () => {
  const caller = new AbortController();
  caller.abort();

  const error = mapFetchAbortError(caller.signal);

  expect(error.code).toBe("cancelled");
  expect(error.code).not.toBe(mapFetchAbortError(abortWithTimeout()).code);
});

it("rejects a signal that has not aborted", () => {
  expect(() => mapFetchAbortError(new AbortController().signal)).toThrow(ModelInteractionError);
  expect(() => mapFetchAbortError(new AbortController().signal)).toThrow(
    expect.objectContaining({ code: "invalid_abort_state" }),
  );
});

/**
 * Creates an already aborted timeout signal.
 *
 * @returns Aborted signal whose reason is a timeout exception.
 */
function abortWithTimeout(): AbortSignal {
  const caller = new AbortController();
  caller.abort(new DOMException("The interaction deadline has expired.", "TimeoutError"));
  return caller.signal;
}
