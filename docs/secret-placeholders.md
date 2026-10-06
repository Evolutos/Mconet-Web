<!-- Copyright © 2026 Mcont. -->

# Secret Placeholder Standard

## Purpose

This standard defines safe placeholder values for source code, documentation, examples, tests, fixtures, environment templates, logs, and screenshots. Its goal is to prevent real credentials and realistic credential-shaped strings from entering the repository or generated artifacts.

A placeholder communicates where a credential is supplied without behaving like a usable credential. It is not a default credential, sample authorization mechanism, or value that production code may silently accept.

## Approved placeholders

Use the following forms consistently:

| Context                          | Approved form                         |
| -------------------------------- | ------------------------------------- |
| Prose or diagrams                | `<provider-api-key>`                  |
| Prose for a temporary user token | `<short-lived-user-token>`            |
| Prose for an application session | `<application-session>`               |
| Environment variable name        | `MCONET_PROVIDER_API_KEY`             |
| Environment template value       | empty value                           |
| Unit-test-only credential        | `TEST_ONLY_DO_NOT_USE`                |
| Redacted output                  | `[REDACTED]`                          |
| Example HTTPS origin             | `https://example.invalid`             |
| Example model or deployment      | `example-model`, `example-deployment` |
| Example tenant or user           | `example-tenant`, `example-user`      |

The `.invalid` top-level domain is required for examples that must not resolve to a real service.

Angle-bracket placeholders are for prose and configuration descriptions. They must not be copied into a real request header or committed as a runtime fallback.

## Server example pattern

Server examples read a credential from the runtime environment, reject a missing value, and hand it to the server-only `CredentialSource` implementation defined by the application. They never provide a literal fallback.

```ts
const providerApiKey = process.env.MCONET_PROVIDER_API_KEY;

if (!providerApiKey) {
  throw new Error("MCONET_PROVIDER_API_KEY is required in the server environment.");
}

// Hand providerApiKey to the server-only CredentialSource.
// Do not log, serialize, return, or expose it to Browser code.
```

The environment template contains only the variable name:

```dotenv
MCONET_PROVIDER_API_KEY=
```

The real value belongs in an ignored local environment file, a CI secret store, or a production secret manager. It must not be written into `.env.example` or another tracked template.

## Browser example pattern

Browser examples do not contain provider credentials. A Browser-to-BFF example uses application authentication configured by the host application.

A direct-provider example obtains a short-lived, scoped, revocable token from an application-supplied provider at runtime:

```ts
const shortLivedToken = await sessionTokenProvider.getToken();

// Hand shortLivedToken to a request-scoped CredentialSource.
// Do not persist it in Browser storage.
```

The example must document the direct-access prerequisites and must not replace `sessionTokenProvider` with a hard-coded string.

## Test and fixture pattern

Tests that only need to identify a credential use the exact constant:

```ts
const testCredential = "TEST_ONLY_DO_NOT_USE";
```

This value is allowed only in test, fixture, and security-test input. Production source and examples must obtain credentials through a `CredentialSource` or equivalent runtime input.

Fixtures that do not test credential application store only language-neutral credential metadata, such as authorization kind or credential-source reference. They do not store a credential value.

Tests for redaction assert the fixed output marker:

```ts
expect(serializedSecret).toBe("[REDACTED]");
```

A test that verifies secret scanning uses an isolated generated input supplied by the scanner test harness. It must not commit a realistic secret-shaped value to a tracked fixture.

## Forbidden values and patterns

Do not commit:

- real provider keys, OAuth credentials, session tokens, signing keys, certificates with private material, database credentials, or cloud access keys;
- strings copied from a provider dashboard, local environment, CI system, browser storage, log, error, screenshot, or network trace;
- realistic values using a provider's known key prefix and expected length;
- JWT-shaped three-segment values;
- PEM private-key blocks;
- high-entropy strings presented as credentials;
- live hostnames, account identifiers, tenant identifiers, or project identifiers when a reserved example value is sufficient;
- encoded, encrypted, split, reversed, compressed, or obfuscated credentials;
- a placeholder such as `changeme`, `password`, or `secret` that code could accidentally accept as a working default.

Changing the representation does not make a real credential safe. Base64, hexadecimal, URL encoding, string concatenation, environment substitution, and encryption with a committed key remain prohibited.

## Forbidden code patterns

Production code and examples must not provide a credential fallback:

```ts
// Forbidden: the literal can become an accidental working credential.
const credential = process.env.MCONET_PROVIDER_API_KEY ?? "TEST_ONLY_DO_NOT_USE";
```

They must not embed credentials in URLs:

```ts
// Forbidden: URLs leak through logs, history, referrers, and diagnostics.
const endpoint = `https://example.invalid/model?api_key=${credential}`;
```

They must not serialize controlled secret values:

```ts
// Forbidden: secret material must not enter JSON, logs, or monitoring.
JSON.stringify({ credential });
console.log(credential);
```

Examples must fail clearly when required server configuration is absent. They must not continue with a placeholder value or downgrade to unauthenticated provider access.

## Environment files

- Commit only environment templates with empty sensitive values.
- Ignore local `.env` variants that may contain values.
- Do not use public or client-prefixed environment variables for provider credentials.
- Do not echo environment values in setup scripts, test output, or CI diagnostics.
- Live tests read credentials only from the CI secret store and remain opt-in.
- Missing live credentials skip or block the explicitly live workflow; they do not change ordinary test behavior.

## Logs, errors, and monitoring

The only approved representation of a credential in logs, errors, diagnostics, snapshots, and monitoring is:

```text
[REDACTED]
```

Do not preserve a prefix, suffix, hash, length, or partial token unless a separately reviewed security design proves it necessary and non-identifying. Error causes must be inspected before serialization because platform or provider errors can contain request headers or URLs.

Request and response bodies are not credential placeholders. They remain excluded from monitoring by default and require independent bounding and redaction when capture is enabled.

## Documentation and screenshots

- Use approved angle-bracket placeholders in prose.
- Use `https://example.invalid` for non-resolving endpoints.
- Crop or redact terminal prompts, environment output, account IDs, URLs, and headers before capturing screenshots.
- Do not paste provider dashboard examples even if a provider labels them temporary.
- Generated API documentation and source maps are scanned like source files.
- Copy-paste examples must require runtime configuration rather than inviting users to replace a literal in source code.

## Allowlist policy

Secret scanning exceptions are narrow and reviewable. An exception must identify:

- the exact file and exact non-secret value;
- why a safer approved placeholder cannot exercise the scanner rule;
- the owner;
- the security test that depends on it;
- the removal condition or review date.

Broad path exclusions, disabled detectors, wildcard values, and repository-wide entropy suppression are not acceptable. An allowlist entry must never be used to retain a real credential.

## Accidental exposure response

If a real credential enters a working tree, commit, artifact, log, issue, or message:

1. stop using it immediately;
2. revoke or rotate it at the issuer;
3. remove it from the current tree and generated artifacts;
4. notify the repository owner through the approved private channel;
5. assess logs, forks, caches, CI artifacts, and deployment output for exposure;
6. coordinate any history rewrite instead of force-pushing unilaterally;
7. add or improve a scanner rule or test that prevents recurrence.

Deleting a Git commit does not revoke a credential and is never the first remediation step.

## Review checklist

- Every credential-bearing example reads runtime configuration or an injected provider.
- Environment templates contain empty sensitive values.
- Browser examples contain no provider credential literal.
- Test credentials use only `TEST_ONLY_DO_NOT_USE` or isolated generated scanner input.
- Documentation uses approved angle-bracket placeholders and `.invalid` endpoints.
- Errors, logs, monitoring, snapshots, and fixtures contain only `[REDACTED]`.
- No credential fallback, URL credential, realistic provider prefix, JWT shape, private-key block, or high-entropy credential is tracked.
- Any scanner exception is exact, owned, justified, tested, and time-bounded.
