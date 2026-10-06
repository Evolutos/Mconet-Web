<!-- Copyright © 2026 Mcont. -->

# ADR 0005: Prefer a BFF for Browser Model Access

- Status: Accepted
- Decision date: 2026-10-06
- Scope: Browser, Web Worker, SSR, and BFF credential and trust boundaries
- Owner: Mcont

## Context

Browser code, runtime state, network requests, storage, bundles, and source maps are observable by users and may also be exposed to injected scripts, browser extensions, compromised dependencies, or shared devices. A secret shipped to or persistently stored by browser code cannot be treated as a confidential server credential.

Model-provider credentials often grant broad account access, incur cost, and outlive one user interaction. The SDK can redact a value after it enters its APIs, but it cannot make a long-lived provider key safe in an untrusted browser environment or bypass browser security controls.

The deployment boundary must therefore distinguish application authentication from provider authentication and make the allowed direct-browser exception explicit.

## Decision

Browser applications should access model providers through an application-owned Backend for Frontend or equivalent server proxy.

```text
Browser application
→ Mconet Browser SDK
→ application BFF or proxy
→ model provider
```

The Browser carries only application-scoped session authority. The BFF keeps provider credentials, provider signing logic, server-side authorization, audit, and provider access policy outside the browser.

Direct Browser-to-provider access is allowed only when every direct-access requirement in this ADR is satisfied. The ability to construct an Authorization header does not establish that a credential is safe for Browser use.

## Trust boundaries

### Browser and Web Worker

Browser and Worker execution is untrusted for long-lived provider secrets. Neither context may receive a provider credential that the deployment expects to keep confidential from the user.

A Worker can isolate CPU work from the DOM, but it does not create a server trust boundary. Messages, bundled code, network requests, and in-memory credentials remain part of the Browser security model.

### BFF and server runtime

The BFF is the provider-credential trust boundary. It runs in a server environment with access to an approved secret store and authenticates the application user or workload before invoking a provider.

Node.js and SSR code are trusted only while they remain server-only. A server credential must not cross into rendered HTML, hydration data, Client Component props, browser-readable environment variables, source maps, or serialized errors.

### Model provider

The provider is a separate origin and authorization domain. The BFF must not assume that application session authority is valid provider authority, or expose provider credentials back to the Browser.

## Browser-to-BFF deployment

The recommended flow is:

```text
1. Browser authenticates to the application.
2. Browser sends a bounded model request to the BFF.
3. BFF validates the application session and authorizes the requested operation.
4. BFF resolves provider access from server-only configuration.
5. BFF forwards only the allowed protocol fields to the provider.
6. BFF returns a bounded, filtered response to the Browser.
```

The Browser SDK targets the BFF endpoint and uses the protocol explicitly exposed by that BFF. The BFF may expose an OpenAI-compatible endpoint or an application-specific protocol with a corresponding Adapter.

The Browser must not know the upstream provider credential. It also need not know the upstream provider endpoint when the application wants to hide or centrally control provider routing.

## BFF responsibilities

The application BFF is responsible for:

- authenticating the application session or workload;
- authorizing model, task, tenant, and feature access;
- obtaining provider credentials from a server-only secret store;
- keeping provider keys and signing material out of Browser-visible responses;
- validating request shape, content size, and allowed protocol fields;
- applying application rate, cost, quota, and abuse controls;
- enforcing allowed upstream schemes, origins, and redirect behavior;
- setting intentional CORS, CSRF, Cookie, and cache policies;
- bounding upstream and downstream request and response sizes;
- redacting audit, error, and observability data;
- preventing one tenant's credentials, requests, or responses from reaching another tenant.

These are deployment responsibilities. The SDK does not silently implement application authentication, business authorization, rate limiting, billing policy, or abuse detection.

## Application session credentials

Browser-to-BFF authentication is application-specific. Supported deployment patterns may include a short-lived bearer token kept in memory or a secure server-issued session Cookie.

If a Cookie session is used:

- Fetch credentials must be enabled explicitly because the Browser transport defaults to `omit`;
- the Cookie should be `Secure`, `HttpOnly`, and use an appropriate `SameSite` policy;
- state-changing endpoints need an application CSRF defense appropriate to their origin model;
- CORS must not combine arbitrary origins with credentialed requests;
- session rotation, revocation, expiration, and logout remain application responsibilities.

If a Browser-readable token is used:

- it must be short-lived, narrowly scoped, audience-bound, and revocable;
- it should remain in memory rather than persistent Browser storage;
- it must not be placed in a URL or emitted to analytics, errors, logs, snapshots, or source maps;
- refresh and recovery behavior must not introduce a long-lived provider secret into the Browser.

Application session credentials must never be reused as provider credentials unless the provider explicitly designed and issued that user-scoped token for direct Browser use.

## Direct Browser-to-provider exception

Direct access is permitted only when all of the following are true:

1. The provider explicitly supports the application's Browser origin through CORS.
2. The provider issues a user- or session-bound credential intended for public-client use.
3. The credential is short-lived, least-privileged, audience-restricted, and revocable.
4. Exposure of the credential to the user does not grant broader account or tenant authority.
5. The endpoint uses `https:` outside explicit local development or controlled tests.
6. Required request headers are allowed by the Browser and required response headers are CORS-exposed.
7. Redirect policy cannot forward credentials or signed headers to another origin.
8. Request, response, Raw Response, and monitoring captures are bounded and redacted.
9. The host application applies an appropriate CSP, dependency policy, output encoding, and incident-response plan.
10. The deployment owner accepts the remaining cost, abuse, extension, XSS, and shared-device risks.

If any requirement is false or unknown, the application must use a BFF or another trusted server boundary.

The SDK must not add an override named or documented as “ignore Browser security,” “disable CORS,” “disable TLS,” or equivalent.

## Secret handling

Long-lived provider credentials are forbidden in:

- Browser bundles and dynamically loaded client modules;
- public or client-prefixed environment variables;
- HTML, hydration payloads, Client Component props, or inline scripts;
- `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, or readable Cookies;
- URLs, query strings, fragments, referrers, or redirect locations;
- errors, diagnostics, logs, analytics, tracing attributes, monitoring events, or snapshots;
- source maps, test fixtures, example files, screenshots, or recorded network traces.

Server-side credentials must enter the SDK through `SecretValue` and controlled credential sources. Their string, JSON, inspection, error, and monitoring representations remain redacted.

Dynamic credentials are read for each interaction during authorization. They are not captured at Client initialization, stored on shared request state, or copied into safe configuration snapshots.

## Endpoint and redirect security

Browser and BFF endpoints are validated before I/O:

- production endpoints require `https:`;
- user information in URLs is rejected;
- CR/LF and invalid schemes are rejected;
- endpoint policy uses explicit allowed origins or application-owned resolution;
- sensitive query values are excluded from diagnostics;
- the safe default rejects redirects;
- cross-origin redirect handling must remove Authorization, Cookie, API-key, proxy authorization, and signing headers before a follow operation;
- redirect loops, malformed locations, disallowed schemes, and unapproved origins fail closed.

The SDK does not infer provider identity from an endpoint string or model name. Protocol and integration selection remain explicit.

## Browser platform controls

The SDK follows Browser enforcement instead of attempting to bypass it:

- CORS controls whether script can access a cross-origin response;
- CSP and Trusted Types are host-application policies;
- Mixed Content rules prevent insecure subrequests from secure pages;
- Fetch defines forbidden headers, credential mode, referrer policy, and redirect behavior;
- TLS validation cannot be disabled by the Browser transport;
- only CORS-exposed response headers are available to the SDK.

A Browser Fetch `TypeError` may not reveal whether CORS, DNS, TLS, offline state, an extension, or another policy caused the failure. Diagnostics must not claim a cause the platform did not expose.

## Model output handling

Model output is untrusted content. SDK examples and convenience views render output as text.

The following patterns are forbidden for unsanitized output:

```text
element.innerHTML = modelText
dangerouslySetInnerHTML({ __html: modelText })
```

Applications that intentionally render HTML, Markdown, links, code, or rich media must apply a context-appropriate sanitizer, URL policy, output encoding, CSP, and Trusted Types policy. The SDK does not declare model-generated markup safe.

Prompt input and model output may contain personal or regulated data. Capturing them for analytics, debugging, or monitoring requires an explicit application policy and remains bounded and disabled by default in SDK monitoring.

## Raw responses, errors, and monitoring

Raw Response capture is disabled by default. If enabled, it has a positive size limit, readonly representation, media-type metadata, truncation state, and redaction policy.

Errors and monitoring may include phase, duration, byte counts, status, component metadata, and safe diagnostics. They must not include:

- provider or application credentials;
- authorization, Cookie, API-key, or signing header values;
- complete request or response bodies;
- sensitive URL query values;
- unredacted provider error text;
- cross-tenant identifiers not approved for telemetry.

Monitoring is observational. A monitor cannot modify authorization, request content, endpoint selection, or transport behavior.

## SSR and framework boundaries

Framework applications must keep server-only and Browser modules separated by static entry points and framework boundaries.

Required rules:

- provider secrets are imported only by server modules;
- server configuration is not re-exported from shared or client modules;
- request-specific identity and access are resolved per request, not stored in module globals;
- Client Component props and loader data contain only Browser-safe values;
- server errors are normalized and redacted before serialization;
- build and bundle checks verify that Browser artifacts contain no provider key, Node built-in, server-only module, or secret-store dependency.

## Examples and documentation

Browser examples use placeholder endpoints and credentials and default to the BFF topology. A direct-access example must state every prerequisite, use a short-lived placeholder token, and explain that it is not a pattern for long-lived provider keys.

Examples must not include realistic secret-shaped values. Build logs, test output, fixtures, and documentation pass the same secret scanning policy as production packages.

## Rejected alternatives

### Store a provider key in persistent Browser storage

Rejected because any script with origin access, an XSS payload, an extension, or a device user can retrieve it. Obfuscation or encryption with a Browser-available key does not create a secret boundary.

### Inject a provider key at Browser build time

Rejected because build-time injection embeds the value in public artifacts or runtime configuration fetched by the Browser.

### Hide the key in a Web Worker

Rejected because a Worker is still controlled by and communicates with Browser code and makes observable network requests.

### Use `no-cors` for direct provider access

Rejected because the resulting opaque response does not expose status, headers, or body and cannot satisfy the Transport contract.

### Proxy every request without authenticating or authorizing it

Rejected because an open relay merely moves the provider key to a server while leaving cost, abuse, and tenant access uncontrolled.

### Render model output as trusted HTML

Rejected because model output and echoed input can contain executable or malicious markup.

## Consequences

Positive consequences:

- long-lived provider credentials stay outside Browser artifacts and storage;
- application and provider authorization remain separate;
- tenant, cost, quota, audit, and abuse policy can be enforced centrally;
- Browser constraints remain explicit instead of being hidden behind SDK options;
- direct access remains possible for providers that issue appropriate public-client credentials;
- examples establish a secure default deployment pattern.

Costs and trade-offs:

- the recommended Browser deployment requires an application server component;
- the BFF adds deployment, latency, scaling, and operational responsibilities;
- Cookie sessions require deliberate credentials, CORS, and CSRF configuration;
- direct provider access has stricter prerequisites and limited diagnostics;
- the SDK cannot guarantee safe rendering or host CSP without application cooperation.

These costs are accepted because a client-side library cannot preserve the confidentiality of a long-lived provider secret.

## Enforcement and review

This ADR is satisfied only when all applicable checks pass:

- Browser examples use a BFF by default and contain no provider secret;
- direct-access examples use only explicit short-lived placeholder credentials and document every prerequisite;
- Browser bundles and source maps pass secret scanning and contain no Node or secret-store dependencies;
- SSR fixtures prove server configuration does not enter Browser bundles, props, hydration data, or serialized errors;
- Browser transport defaults to omitted credentials and safe redirect/referrer behavior;
- redirect tests prove sensitive headers do not cross origins;
- errors, diagnostics, logs, analytics, monitoring, snapshots, fixtures, and test recordings contain no Secret;
- endpoint tests reject invalid schemes, user information, CR/LF, and disallowed redirects;
- response and Raw Response limits are enforced during reading;
- Chromium, Firefox, and WebKit tests cover CORS-visible and CORS-hidden behavior;
- example output is rendered as text and no example uses unsanitized `innerHTML` or `dangerouslySetInnerHTML`;
- BFF examples authenticate and authorize requests rather than acting as an open relay.

Any proposal to ship long-lived provider credentials to Browser code, persist them in Browser-readable storage, bypass Browser security controls, serialize server secrets to clients, or treat model output as trusted markup requires a new ADR that supersedes this decision.
