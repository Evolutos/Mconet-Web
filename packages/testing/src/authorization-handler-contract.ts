// Copyright © 2026 Mcont.

import { describe, expect, it } from "vitest";

import type { AuthorizationHandler } from "@evolutos/mconet-core-spi";

import { assertSecretAbsent } from "./assert-secret-absent.js";

/** Complete reusable fixture required by the AuthorizationHandler contract suite. */
export interface AuthorizationHandlerContractFixture {
  /** Fresh handler used for support and successful application checks. */
  readonly handler: AuthorizationHandler;
  /** Authorization description and expected deterministic support decision. */
  readonly support: Readonly<{
    authorization: Parameters<AuthorizationHandler["supports"]>[0];
    expected: ReturnType<AuthorizationHandler["supports"]>;
  }>;
  /** Plaintext known only to the test and the configured credential behavior. */
  readonly secretPlaintext: string;
  /** Header names allowed to carry protected authorization material. */
  readonly protectedHeaderNames: readonly string[];
  /** Successful application input, output, and observable diagnostic carriers. */
  readonly application: Readonly<{
    input: Parameters<AuthorizationHandler["apply"]>[0];
    expected: Awaited<ReturnType<AuthorizationHandler["apply"]>>;
    getObservableCarriers: () => readonly unknown[];
  }>;
  /** Fresh handler configured to encounter an unsafe header value. */
  readonly unsafeHeaderHandler: AuthorizationHandler;
  /** Unsafe application input, injected text, error, and observable carriers. */
  readonly unsafeHeader: Readonly<{
    input: Parameters<AuthorizationHandler["apply"]>[0];
    injectedText: string;
    expected: Error;
    getObservableCarriers: () => readonly unknown[];
  }>;
}

/**
 * Registers the reusable behavioral contract for one AuthorizationHandler.
 *
 * @param name Stable implementation name shown in contract test reports.
 * @param createFixture Factory returning isolated support and application fixtures.
 */
export function defineAuthorizationHandlerContract(
  name: string,
  createFixture: () => AuthorizationHandlerContractFixture,
): void {
  // Keep support, successful authorization, and rejection paths independent so
  // handler state or observed credentials cannot leak between contract cases.
  describe(`${name} AuthorizationHandler contract`, () => {
    it("reports deterministic support without mutating authorization", () => {
      const { handler, support } = createFixture();
      const authorizationSnapshot = structuredClone(support.authorization);

      // Selection is a synchronous inspection only; repeated checks must expose
      // the same decision without rewriting the open authorization description.
      expect(support.expected).toBe(true);
      expect(handler.supports(support.authorization)).toBe(support.expected);
      expect(handler.supports(support.authorization)).toBe(support.expected);
      expect(support.authorization).toEqual(authorizationSnapshot);
    });

    it("returns a new request with safe headers and no secret outside protected headers", async () => {
      const { application, handler, protectedHeaderNames, secretPlaintext } = createFixture();
      const requestSnapshot = structuredClone(application.input.request);
      const authorizationSnapshot = structuredClone(application.input.authorization);
      const { signal, ...contextWithoutSignal } = application.input.context;
      const contextSnapshot = structuredClone(contextWithoutSignal);

      // A useful leak test requires non-empty plaintext and at least one explicit
      // protected header boundary; header names themselves may never contain CR/LF.
      expect(secretPlaintext.length).toBeGreaterThan(0);
      expect(protectedHeaderNames.length).toBeGreaterThan(0);
      for (const headerName of protectedHeaderNames) {
        expect(headerName).not.toMatch(/[\r\n]/u);
      }

      const actual = await handler.apply(application.input);
      const protectedNames = new Set(protectedHeaderNames.map((value) => value.toLowerCase()));
      const protectedHeaders = actual.headers.filter((header) =>
        protectedNames.has(header.name.toLowerCase()),
      );
      const unprotectedHeaders = actual.headers.filter(
        (header) => !protectedNames.has(header.name.toLowerCase()),
      );

      // Every output header is safe for later serialization, while the expected
      // protected occurrence proves the fixture did not bypass authorization.
      for (const header of actual.headers) {
        expect(header.name).not.toMatch(/[\r\n]/u);
        expect(header.value).not.toMatch(/[\r\n]/u);
      }
      expect(protectedHeaders.length).toBeGreaterThan(0);
      expect(actual).toEqual(application.expected);
      expect(actual).not.toBe(application.input.request);

      // Scan every observable location except the explicitly protected header
      // values whose sole purpose is carrying authorization to the transport.
      assertSecretAbsent(
        secretPlaintext,
        application.input.request,
        application.input.authorization,
        contextWithoutSignal,
        {
          method: actual.method,
          url: actual.url,
          headers: unprotectedHeaders,
          query: actual.query,
          body: actual.body,
        },
        ...application.getObservableCarriers(),
      );
      expect(application.input.request).toEqual(requestSnapshot);
      expect(application.input.authorization).toEqual(authorizationSnapshot);
      const { signal: actualSignal, ...actualContextWithoutSignal } = application.input.context;
      expect(actualSignal).toBe(signal);
      expect(actualContextWithoutSignal).toEqual(contextSnapshot);
    });

    it("rejects CR/LF header injection without exposing secret plaintext", async () => {
      const { secretPlaintext, unsafeHeader, unsafeHeaderHandler } = createFixture();
      const requestSnapshot = structuredClone(unsafeHeader.input.request);
      const authorizationSnapshot = structuredClone(unsafeHeader.input.authorization);
      const { signal, ...contextWithoutSignal } = unsafeHeader.input.context;
      const contextSnapshot = structuredClone(contextWithoutSignal);

      // The fixture must contain a real line-break injection attempt and a safe
      // standard Error expectation rather than testing an unrelated rejection.
      expect(unsafeHeader.injectedText).toMatch(/[\r\n]/u);
      expect(unsafeHeader.expected).toBeInstanceOf(Error);
      const attempt = unsafeHeaderHandler.apply(unsafeHeader.input);
      await expect(attempt).rejects.toBeInstanceOf(Error);
      await expect(attempt).rejects.toEqual(unsafeHeader.expected);
      assertSecretAbsent(
        secretPlaintext,
        unsafeHeader.expected,
        ...unsafeHeader.getObservableCarriers(),
      );
      expect(unsafeHeader.input.request).toEqual(requestSnapshot);
      expect(unsafeHeader.input.authorization).toEqual(authorizationSnapshot);
      const { signal: actualSignal, ...actualContextWithoutSignal } = unsafeHeader.input.context;
      expect(actualSignal).toBe(signal);
      expect(actualContextWithoutSignal).toEqual(contextSnapshot);
    });
  });
}
