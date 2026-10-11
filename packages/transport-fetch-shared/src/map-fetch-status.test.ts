// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";
import { expect, it } from "vitest";

import { mapFetchStatus } from "./map-fetch-status.js";

it.each([200, 201, 204, 299])("maps HTTP %s to success", (status) => {
  expect(mapFetchStatus(status)).toBe("success");
});

it.each([400, 401, 404, 429, 499])("maps HTTP %s to a service error", (status) => {
  expect(mapFetchStatus(status)).toBe("service_error");
});

it.each([500, 502, 503, 599])("maps HTTP %s to a service error", (status) => {
  expect(mapFetchStatus(status)).toBe("service_error");
});

it.each([100, 301, 302, 304])(
  "maps the non-success HTTP status %s to a service error",
  (status) => {
    expect(mapFetchStatus(status)).toBe("service_error");
  },
);

it("maps an opaque status to a transport error", () => {
  expect(mapFetchStatus(0)).toBe("transport_error");
});

it.each([Number.NaN, -1, 99, 600, 200.5])("rejects the unusable status %s", (status) => {
  expect(() => mapFetchStatus(status)).toThrow(ModelInteractionError);
  try {
    mapFetchStatus(status);
  } catch (error) {
    expect(error).toMatchObject({
      category: "protocol",
      phase: "transport",
      code: "invalid_fetch_status",
      message: "Fetch status is not an HTTP response status.",
    });
    expect(String(error)).not.toContain(String(status));
  }
});
