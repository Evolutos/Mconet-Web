// Copyright © 2026 Mcont.

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

/** The only body-signing mode the initial unary HTTP path implements. */
const SUPPORTED_BODY_SIGNING_MODE = "none";

/** Stable code for a body-signing mode this runtime does not implement. */
const UNSUPPORTED_BODY_SIGNING_CODE = "unsupported_body_signing";

/**
 * Rejects every body-signing mode other than `none`.
 *
 * R1 authorization does not sign a request body. The check reads only the mode
 * token and fails closed for any other value, including a value that is not a
 * string. It does not read credentials, call a handler, or copy the rejected
 * mode into the error.
 *
 * @param bodySigningMode Mode supplied for one authorization attempt.
 * @throws {ModelInteractionError} With `unsupported_body_signing` when the mode
 * is not `none`.
 */
export function assertSupportedBodySigningMode(
  bodySigningMode: unknown,
): asserts bodySigningMode is "none" {
  if (bodySigningMode === SUPPORTED_BODY_SIGNING_MODE) {
    return;
  }

  throw new ModelInteractionError({
    message: "Body signing is not supported.",
    category: "unsupported_feature",
    phase: "authorization",
    code: UNSUPPORTED_BODY_SIGNING_CODE,
    diagnostics: [
      {
        code: UNSUPPORTED_BODY_SIGNING_CODE,
        severity: "error",
        phase: "authorization",
        message: "Only the none body-signing mode is supported.",
      },
    ],
  });
}
