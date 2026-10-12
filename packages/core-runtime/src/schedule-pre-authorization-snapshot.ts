// Copyright © 2026 Mcont.

import type { TransportRequest } from "@evolutos/mconet-core-spi";

import { createSafePreAuthorizationRequestSnapshot } from "./create-safe-pre-authorization-request-snapshot.js";
import type { SafePreAuthorizationRequestSnapshot } from "./safe-pre-authorization-request-snapshot.js";

/**
 * Schedules the pre-authorization monitoring snapshot.
 *
 * The existing mapper drops authorization headers, query text, and the body
 * bytes. This stage does not apply authorization, and it does not keep a second
 * copy of the encoded body.
 *
 * @param request Encoded request observed before an authorization handler runs.
 * @returns A frozen snapshot with no secret and no body bytes.
 */
export function schedulePreAuthorizationSnapshot(
  request: TransportRequest,
): SafePreAuthorizationRequestSnapshot {
  return createSafePreAuthorizationRequestSnapshot(request);
}
