<!-- Copyright © 2026 Mcont. -->

# ADR 0004: Use Fetch as the Default HTTP Transport

- Status: Accepted
- Decision date: 2026-10-06
- Scope: HTTP/HTTPS byte transport in browsers, Web Workers, and Node.js 20+
- Owner: Mcont

## Context

Unary JSON interactions need one default transport. The transport must work in modern browsers, Web Workers, and Node.js 20+, propagate cancellation, enforce response limits while reading, preserve HTTP metadata needed by later stages, and keep authorization and protocol semantics outside the networking layer.

Using a third-party HTTP client as a Core dependency would add another request, stream, cancellation, and error model on top of platform standards. A single cross-platform implementation would also risk importing Node networking types into browser bundles or weakening browser security rules to imitate server behavior.

The Fetch API provides the required request, response-stream, and `AbortSignal` primitives across the supported runtimes, but platform policy and resource ownership still differ. The architecture therefore needs one transport contract with separate Browser and Node implementations.

## Decision

The SDK uses the standard Fetch API as its default HTTP/HTTPS transport. Browser and Node implementations live in separate packages and satisfy the same `Transport` SPI and Contract Suite.

The concrete packages are:

```text
@evolutos/mconet-transport-fetch-browser
@evolutos/mconet-transport-fetch-node
```

Core packages depend only on the Transport SPI. Client entry points and default factories explicitly compose the correct platform package; Core does not detect the runtime by reading `window`, `document`, or `process` at module initialization.

The default request path is:

```text
encoded and authorized TransportRequest
→ platform Fetch transport
→ request mapping and safety checks
→ fetch with effective AbortSignal
→ status and safe metadata normalization
→ incrementally bounded response read
→ TransportResponse with Uint8Array body
```

Fetch is the default implementation, not part of the domain or protocol contract. A compatible injected Transport may replace it when it satisfies the execution plan, type contract, and required capabilities.

## Transport boundary

The shared SPI shape is:

```ts
interface Transport {
  send(request: TransportRequest, context: TransportContext): Promise<TransportResponse>;
}

interface TransportContext {
  readonly signal: AbortSignal;
  readonly deadline?: number;
  readonly maxResponseBodyBytes: number;
}

interface TransportResponse {
  readonly metadata: TransportResponseMetadata;
  readonly body: Uint8Array;
}
```

These interfaces are illustrative in this ADR and are introduced by their dedicated atomic steps.

Transport receives a request whose body is already encoded and whose authorization has already been applied. It does not import or interpret Task, Message, Adapter, Codec, ServiceAccess, CredentialSource, or provider-specific payload types.

## Request mapping

The shared Fetch mapping layer performs these operations before network I/O:

```text
validate supported HTTP method
→ validate absolute HTTP/HTTPS URL and merge ordered query fields
→ validate and map ordered multi-value headers
→ map bytes body
→ resolve effective cancellation signal
→ apply platform request policy
→ call fetch
```

Request rules are:

- only methods explicitly supported by the execution plan are accepted;
- production endpoints use `https:`; explicitly configured local development and controlled tests may use `http:`;
- URL construction uses structured URL operations rather than string concatenation;
- query entries preserve duplicate names and declared order;
- header names and values are validated before creating platform `Headers`;
- CR or LF in a header name or value is rejected;
- browser-forbidden request headers fail clearly rather than being silently dropped;
- the supported body input is `{ kind: "bytes"; bytes: Uint8Array }`;
- Transport does not add, refresh, or reinterpret authorization.

Repeated query and header semantics remain explicit in SDK values. When a platform Fetch implementation combines a header according to HTTP rules, response metadata must report only what the platform exposes and must not fabricate original multiplicity.

## Cancellation and deadline

The runtime composes the caller's cancellation and deadline into an effective `AbortSignal`. The Fetch transport passes that signal to `fetch` and to response-body reading.

Required behavior:

- if the effective signal is already aborted, no request is started;
- caller cancellation and deadline expiration remain distinguishable in normalized SDK errors;
- aborting while awaiting headers terminates the Fetch request;
- aborting while reading the body cancels the reader and releases response resources;
- a network failure must not be mislabeled as caller cancellation merely because a later abort occurs;
- an interaction reaches exactly one terminal outcome when abort, limit, network, and completion events race;
- Transport does not create a detached timeout that can fire after the interaction completes.

Platform-specific Fetch rejection objects are implementation details. Native error names and messages do not become the public cancellation contract.

## Response streaming and size limits

The transport enforces `maxResponseBodyBytes` during reading. It must not call `response.arrayBuffer()` and check the size only after the complete body has been allocated.

The required algorithm is:

```text
obtain Response.body reader
→ read one chunk
→ validate chunk and checked cumulative length
→ fail and cancel before retaining bytes beyond the limit
→ retain the accepted chunk
→ repeat until done
→ combine accepted chunks into one bounded Uint8Array
```

Additional requirements:

- the configured limit is a validated positive finite integer;
- cumulative length arithmetic must not overflow;
- an absent response body produces an empty `Uint8Array`;
- zero-length chunks do not terminate reading;
- reader locks and response resources are released on success, error, cancellation, and limit failure;
- full response copies are not created for logging or monitoring;
- any optional Raw Response capture has its own limit and redaction policy outside Transport's primary body ownership.

The unary transport returns a bounded in-memory `Uint8Array`. Server streaming requires a separate lifecycle, single-consumer, backpressure, and cancellation design and is not represented by a placeholder API.

## HTTP status and metadata

Fetch resolves normally for HTTP error statuses. Transport therefore normalizes a received response rather than throwing solely because its status is non-2xx.

Status mapping is:

- 2xx responses become the success transport outcome;
- received non-2xx HTTP responses become the service-error outcome unless a more specific reviewed transport outcome applies;
- Fetch rejection, unusable opaque responses, and body-read failures become normalized transport/network failures;
- provider error JSON remains an opaque byte body for the preselected error decoder and Adapter.

Transport metadata includes the actual status, final response URL when safely available, parsed media type when visible, and only the reviewed safe header summary. It does not expose authorization, cookies, signing headers, or arbitrary complete response headers through diagnostics or monitoring.

Missing or CORS-hidden metadata remains absent. The Browser transport does not invent a Content-Type or claim that an inaccessible header had a value.

## Browser implementation

The Browser package works in both Window and Web Worker contexts. It accepts an explicitly injected Fetch-compatible function or uses the platform global `fetch` at instance construction or call time according to the final options contract. Merely importing the package does not access browser globals or start work.

Browser defaults and invariants are:

- credentials default to `omit`;
- cookies are included only through explicit configuration backed by the deployment threat model;
- referrer policy defaults to `no-referrer`;
- redirects do not forward Authorization, Cookie, API-key, or signing headers across origins;
- the safe default rejects redirects unless an explicit policy enables behavior whose credential handling can be guaranteed;
- `mode: "no-cors"` is not used to hide CORS failures because opaque responses cannot satisfy the SDK contract;
- forbidden browser headers are rejected before calling Fetch;
- only CORS-exposed response headers are consumed;
- there is no option to disable TLS validation, CORS, CSP, Mixed Content, redirect, or Fetch credential enforcement;
- no Node built-in, polyfill, dispatcher, or connection-pool implementation enters the browser package.

A browser network `TypeError` can represent CORS, DNS, TLS, offline, extension, or other policy failures. The SDK reports a safe, actionable network category but does not claim a more specific cause that the platform did not expose.

The transport does not make long-lived provider secrets safe in a browser. Recommended deployment and BFF boundaries are recorded by the dedicated Browser/BFF security decision.

## Node.js implementation

The Node package targets Node.js 20+ and uses the standard Fetch API shape. It may accept an injected Fetch-compatible function and a Node-specific Dispatcher or connection resource through explicit options.

Node ownership rules are:

- an application-injected Dispatcher or connection resource is application-owned;
- `ModelClient.close()` does not close application-owned resources;
- a Dispatcher or connection resource created by an SDK factory is SDK-owned;
- SDK-owned resources are closed exactly once when their owning Client closes;
- closing one Client does not invalidate resources owned by another Client;
- no request-specific identity, credential, signal, deadline, or body is stored on a reusable Dispatcher;
- the package documents whether the global Fetch pool or an explicit SDK-owned resource is used.

Node-specific imports remain inside the Node transport package and Node entry points. They cannot leak into Browser conditions, declarations, examples, or bundles.

Node defaults follow the same endpoint, redirect, response-limit, error-normalization, and authorization-leak rules as Browser where the platform allows. The SDK does not expose a convenience option that disables TLS certificate validation.

## Redirect policy

Redirects are security-relevant because the request reaching a new origin may contain credentials or signed headers.

The default Fetch transports reject redirects. A future or explicit redirect-follow policy must:

1. impose a finite redirect count;
2. resolve each location as a structured URL;
3. revalidate scheme and destination policy;
4. strip Authorization, Cookie, API-key, proxy authorization, and signing headers before any cross-origin hop;
5. define method and body rewriting without relying on provider-specific guesses;
6. preserve cancellation and the original response-size limit;
7. expose only a safe final URL in metadata;
8. reject redirect loops and malformed locations.

Browser Fetch behavior that is not observable because of CORS or opaque redirects must not be reconstructed or guessed. Explicit redirect support is accepted only when Contract and platform integration tests prove the security invariants.

## Error normalization

The transport converts platform failures into stable SDK transport errors. Public behavior distinguishes at least:

- caller cancellation;
- deadline timeout;
- response body limit exceeded;
- unsupported or unsafe request mapping;
- redirect policy failure;
- network or browser-policy failure;
- response body read failure.

Normalized errors and diagnostics must not contain:

- authorization, API-key, Cookie, Set-Cookie, proxy, or signing header values;
- request or response bodies;
- URL user information or sensitive query values;
- native error objects whose printable representation may contain request options;
- Dispatcher internals or connection details that are not safe for consumers.

Exact public error classes and codes are defined by their dedicated atomic steps. Browser and Node implementations produce equivalent categories for equivalent contract failures while retaining safe platform diagnostics where available.

## Component selection and replacement

The default factory supplies a Fetch transport only after the Adapter has produced an HTTP/HTTPS byte plan. Selection follows:

```text
InteractionOptions
> ModelClientConfiguration
> Integration/Plugin
> platform SDK default Fetch transport
```

An explicit Transport that does not satisfy the plan, type contract, body kind, or required capabilities fails before credentials are read and before I/O. It does not fall back to Fetch.

Alternative transports such as WebSocket, WebTransport, gRPC, or a test Transport require their own packages and lifecycle decisions. They are not selected by URL guessing or runtime environment detection.

## Rejected alternatives

### Add Axios or another HTTP client to Core

Rejected because it duplicates Fetch primitives, increases browser bundle and supply-chain surface, introduces a different cancellation/error model, and couples Core to a concrete network library.

### Publish one universal Fetch package

Rejected because Browser and Node have different globals, type libraries, security controls, connection ownership, and packaging constraints. A shared internal mapping algorithm is allowed, but public platform packages remain separate.

### Read the complete body before checking its size

Rejected because it permits allocation beyond the configured limit and cannot provide early cancellation against untrusted responses.

### Parse JSON or provider errors in Transport

Rejected because Transport must remain byte- and HTTP-focused; decoders and Adapters own those semantics.

### Automatically include browser cookies

Rejected because it changes CSRF, SameSite, CORS, and tenant-isolation assumptions. The default is `omit`.

### Work around CORS with `no-cors`

Rejected because opaque responses hide status, headers, and body and therefore cannot satisfy the Transport contract.

### Follow redirects with sensitive headers

Rejected because a service or compromised endpoint could redirect credentials to another origin. The safe default rejects redirects.

### Close every injected connection resource

Rejected because application-injected resources may be shared outside the Client. Ownership is explicit at composition time.

## Consequences

Positive consequences:

- the default transport uses standards already present in every supported runtime;
- cancellation and response streaming use one platform model;
- Browser bundles contain no Node networking code;
- Node connection ownership is explicit;
- response limits are enforced before complete allocation;
- Codec and Adapter remain independent of HTTP execution;
- tests can inject Fetch deterministically without a public Registry.

Costs and trade-offs:

- Browser and Node packages maintain separate platform adapters;
- strict redirect and credential defaults require explicit opt-in for some deployments;
- browsers expose limited diagnostics for CORS and network failures;
- unary responses still require one final bounded `Uint8Array` allocation;
- Fetch implementation differences require Contract plus platform integration tests;
- callers needing non-Fetch transports must provide separate compatible components.

These costs are accepted for a secure, portable, and minimal network foundation.

## Enforcement and review

This ADR is satisfied only when all applicable checks pass:

- Core packages import Transport SPI only and do not import Fetch implementations or third-party HTTP clients;
- Browser and Node Fetch transports are separate packages with side-effect-free entry points;
- Browser package source and bundle contain no `node:*`, Node polyfill, Dispatcher, or connection-pool dependency;
- request mapping tests cover methods, absolute URLs, duplicate query fields, duplicate headers, CR/LF, forbidden browser headers, and empty/non-empty byte bodies;
- cancellation tests cover pre-abort, caller abort before headers, abort during body read, deadline, and terminal-event races;
- body tests prove incremental reading, checked cumulative limits, immediate cancellation on overflow, empty bodies, zero-length chunks, read failure, and resource release;
- status tests cover 2xx, 3xx policy, 4xx, 5xx, opaque/inaccessible responses, missing metadata, and safe header summaries;
- Browser tests cover injected/global Fetch, Window, Worker, credentials default, redirect safety, referrer policy, CORS-hidden headers, and Chromium/Firefox/WebKit behavior;
- Node tests cover Node 20+, injected Fetch, application/SDK Dispatcher ownership, redirects, timeout, interrupted bodies, limits, and close idempotence;
- Transport Contract Suite produces equivalent public outcomes on Browser and Node;
- package-condition tests resolve Browser and Node consumers to their intended entries;
- errors, diagnostics, monitoring, snapshots, and logs contain no Secret, sensitive header, body, or sensitive query value.

Any proposal to replace Fetch as the default, merge Browser and Node packaging, read full bodies before enforcing limits, parse provider payloads in Transport, include credentials by default, or follow cross-origin redirects with sensitive headers requires a new ADR that supersedes this decision.
