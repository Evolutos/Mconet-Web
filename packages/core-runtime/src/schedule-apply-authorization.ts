// Copyright © 2026 Mcont.

import type { Authorization, ProcessingResult } from "@evolutos/mconet-core-domain";
import type {
  AuthorizationContext,
  AuthorizationHandler,
  Transport,
  TransportRequest,
} from "@evolutos/mconet-core-spi";

/** Stable code when applying authorization fails before any network call. */
const authorizationFailedCode = "authorization_failed";

/** Stable code when an applied header can inject another field. */
const invalidAuthorizationHeaderValueCode = "invalid_authorization_header_value";

/** Characters that would split one header field into another. */
const headerLineBreak = /[\0\r\n]/u;

/**
 * Schedules authorization application and checks the resulting headers.
 *
 * The handler is called once. Every returned header name and value must stay
 * inside one field. A line break or NUL fails without copying the header text
 * and without calling the transport. A handler rejection is likewise kept off
 * the transport, and its message is not copied because it may contain a secret.
 *
 * @param input Handler, request, authorization, context, and the idle transport.
 * @returns The authorized request, or diagnostics and no value.
 */
export async function scheduleApplyAuthorization(input: {
  readonly handler: AuthorizationHandler;
  readonly request: TransportRequest;
  readonly authorization: Authorization;
  readonly context: AuthorizationContext;
  readonly transport: Transport;
}): Promise<ProcessingResult<TransportRequest>> {
  let authorized: TransportRequest;
  try {
    authorized = await input.handler.apply({
      request: input.request,
      authorization: input.authorization,
      context: input.context,
    });
  } catch {
    return failure(authorizationFailedCode, "Authorization could not be applied.");
  }

  if (!headersAreSafe(authorized.headers)) {
    // The transport must not send a request whose headers can inject a field.
    return failure(
      invalidAuthorizationHeaderValueCode,
      "An authorization header must stay inside one field.",
    );
  }

  return { diagnostics: [], value: authorized };
}

/**
 * Returns whether every header name and value is a single field.
 *
 * @param headers Header occurrences returned by the handler.
 * @returns Whether none of them contain NUL, CR, or LF.
 */
function headersAreSafe(headers: TransportRequest["headers"]): boolean {
  if (!Array.isArray(headers)) {
    return false;
  }
  return headers.every(
    (header) =>
      typeof header?.name === "string" &&
      typeof header.value === "string" &&
      !headerLineBreak.test(header.name) &&
      !headerLineBreak.test(header.value),
  );
}

/**
 * Returns an authorization failure that does not include header or secret text.
 *
 * @param code Stable diagnostic code.
 * @param message Technical summary safe to retain.
 * @returns A processing result without a request.
 */
function failure(code: string, message: string): ProcessingResult<TransportRequest> {
  return {
    diagnostics: [
      {
        code,
        severity: "error",
        phase: "authorization",
        message,
      },
    ],
  };
}
