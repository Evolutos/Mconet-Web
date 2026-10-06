<!-- Copyright © 2026 Mcont. -->

# ADR 0003: Use JSON as the Default Wire Codec

- Status: Accepted
- Decision date: 2026-10-06
- Scope: payload encoding, success/error decoding, media-type validation, and default composition
- Owner: Mcont

## Context

The supported text-unary interaction path runs in modern browsers, Web Workers, and Node.js 20+. The default OpenAI-compatible integration uses JSON request and response payloads over an HTTP/HTTPS byte transport.

The architecture separates protocol mapping, payload encoding, transport, authorization, and response parsing. Without an explicit codec decision, these responsibilities can collapse into one provider-specific HTTP client:

- an Adapter might serialize JSON and produce transport bytes itself;
- a Transport might parse response bodies or understand provider errors;
- Content-Type might silently select a different decoder after I/O;
- JavaScript coercion could turn unsupported values into valid-looking JSON;
- browser and Node implementations could use different text encodings or error behavior;
- malformed or oversized payloads could leak complete response bodies into errors.

The SDK needs a default that works without explicit codec injection while preserving the SPI boundary for future wire formats.

## Decision

The SDK uses JSON encoded as UTF-8 bytes as its default wire format. The default factory explicitly composes the JSON codec package; Core depends only on codec SPI contracts and does not import the concrete JSON implementation.

The default path is:

```text
Adapter protocol payload
→ JsonPayloadEncoder
→ UTF-8 bytes TransportBody
→ Authorization
→ Fetch Transport
→ bounded response bytes
→ preselected JsonSuccessPayloadDecoder or JsonErrorPayloadDecoder
→ Adapter response parsing
```

JSON is the default, not an assumption embedded in every layer. An integration plan declares its required wire format and type contracts. An injected codec may satisfy that plan, but it cannot change the plan or cause the runtime to select a different protocol.

## Layer responsibilities

### Adapter

The protocol Adapter owns provider payload shape. It maps domain requests into an `ErasedRuntimeValue` whose type and schema identifiers match the JSON encoder's declared input contract.

The Adapter does not:

- call `JSON.stringify` or `JSON.parse`;
- encode or decode UTF-8;
- read or write credentials;
- execute HTTP requests;
- choose a codec from a response header.

### JSON codec

The JSON codec owns:

- runtime validation of values accepted by its JSON type contract;
- JSON text serialization and parsing;
- UTF-8 byte encoding and strict UTF-8 decoding;
- JSON media-type matching;
- normalization of codec failures into stable SDK errors;
- codec descriptors, type contracts, and capabilities.

The JSON codec does not import Task, Message, ServiceAccess, Authorization, provider integrations, or concrete Transport packages.

### Transport

Transport sends and receives bytes. It owns bounded response collection and HTTP metadata extraction, but it does not parse JSON or provider error payloads.

### Runtime

Runtime selects and validates the encoder and both response decoders before I/O. It validates the actual response media type against the preselected decoder, invokes the decoder selected for the transport outcome, and passes the decoded payload to the Adapter.

## JSON value contract

The encoder accepts only values that satisfy the reviewed JSON payload contract. At minimum, the data model is composed from:

```ts
type JsonPrimitive = string | number | boolean | null;

type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
```

TypeScript types are not runtime validation. Before serialization, the encoder must reject values that JSON cannot represent faithfully, including:

- `undefined`, `bigint`, `symbol`, and functions;
- non-finite numbers;
- cyclic structures;
- sparse array holes or unsupported host objects;
- values that rely on custom `toJSON` or getter side effects to become serializable;
- `SecretValue` or any other non-JSON SDK object.

The encoder must not silently convert unsupported object properties to omission, array entries to `null`, or non-finite numbers to `null`. Serialization occurs only after the complete value passes the JSON payload validator.

Detailed optional-field, empty-collection, number-range, object-key, and canonical-comparison rules are defined by the dedicated base serialization convention. The production request encoder preserves array order and the validated payload's object semantics; it does not sort keys merely to match test fixtures.

## Request encoding

`JsonPayloadEncoder` performs these operations in order:

```text
validate ErasedRuntimeValue type/schema contract
→ validate JSON value recursively
→ serialize JSON text
→ encode text as UTF-8
→ return { kind: "bytes", bytes }
```

The encoder returns a byte body and does not authorize the request. Request media type and protocol headers originate from the protocol request plan; the codec may validate their compatibility but does not import access or authorization data.

UTF-8 encoding must preserve Unicode scalar values, non-BMP characters, emoji, combining marks, line breaks, and the empty string. The same observable byte sequence is required in Browser, Worker, and Node runtimes.

The codec must use standards-based UTF-8 behavior and must not depend on Node-only `Buffer` in shared or browser code.

## Response decoding

Success and service-error payloads use separate decoder instances and separate type contracts, even when both parse JSON. Both decoders are selected and frozen before the request is sent.

Response handling follows this order:

```text
Transport returns bounded bytes and metadata
→ outcome selects the already-frozen success or error decoder
→ Runtime validates Content-Type compatibility
→ decoder strictly decodes UTF-8
→ decoder parses exactly one JSON value
→ decoder validates the output type contract
→ Adapter parses success or service error semantics
```

The decoder must reject:

- invalid UTF-8 rather than replacing invalid byte sequences;
- an empty or whitespace-only body where a JSON payload is required;
- malformed JSON or trailing non-whitespace data;
- decoded values outside the JSON type contract;
- payloads that exceed the applicable response or codec limit.

JSON `null` is a valid JSON value at the codec boundary. Whether a particular protocol success or error schema permits `null` is decided by the Adapter's payload contract, not by generic JSON syntax handling.

The decoder performs plain data parsing only. It does not use an application-provided reviver, instantiate classes, resolve references, merge parsed objects into prototypes, or execute code from payload fields.

## Media-type policy

The default JSON codec accepts media types that are syntactically valid and match either:

```text
application/json
application/*+json
```

Type and subtype matching is case-insensitive. Syntactically valid parameters such as `charset=utf-8` are permitted; parameters do not change the required UTF-8 byte decoding. Unsupported charsets are incompatible rather than being decoded with a platform-specific fallback.

Missing, malformed, or incompatible Content-Type fails media-type validation before JSON parsing in the default path. The runtime does not sniff a body that claims another media type and does not use Content-Type to discover or replace a decoder after the response arrives.

Request plans for the default JSON path must declare a compatible JSON media type. The codec cannot rewrite a non-JSON protocol plan into JSON.

## Resource limits and copying

Response bytes are bounded before parsing. The Transport incrementally enforces `maxResponseBodyBytes` and aborts collection when the limit is exceeded. The decoder also honors the relevant codec context limit and does not accept an oversized preconstructed byte array from another Transport implementation.

The unavoidable byte-to-string conversion stays within that validated bound. The codec must not create additional full-body copies for logging, monitoring, error construction, retries, or format detection.

Codec errors must not include the complete payload text or bytes. Safe diagnostics may include bounded metadata such as phase, media type, byte length, and a parser category. Any future payload preview must be separately bounded, redacted, and disabled by default.

## Error normalization

Native `TypeError`, `SyntaxError`, `RangeError`, text-decoder exceptions, and implementation-specific messages must not escape as the public failure contract.

The codec maps failures to stable SDK encoding or decoding errors with the correct interaction phase. The normalized error:

- preserves a safe cause as `unknown` only where policy permits;
- contains no Secret, authorization header, complete request payload, or complete response body;
- distinguishes incompatible type contracts, invalid JSON values, invalid UTF-8, malformed JSON, incompatible media type, and exceeded limits through stable diagnostics;
- produces equivalent public semantics across Browser, Worker, and Node.

Exact public error types and codes are introduced by their dedicated atomic implementation steps; this ADR freezes the categories and safety behavior without defining those types early.

## Component selection and replacement

The default factory supplies JSON encoder and decoder instances only when no higher-priority explicit component exists. Selection follows the accepted component-composition decision:

```text
InteractionOptions
> ModelClientConfiguration
> Integration/Plugin
> SDK default JSON codec
```

An explicit encoder or decoder that does not satisfy the plan, type contract, or required capabilities fails before credential access and network I/O. The runtime must not fall back to the default JSON codec.

Future Protobuf, XML, CBOR, multipart, or streaming codecs can be delivered as independent packages after their body kinds and lifecycle semantics are designed. They do not change the published `{ kind: "bytes" }` branch or cause Core to depend on JSON.

## Security and determinism

The default JSON path must preserve these security properties:

- no credential or authorization object enters the codec input;
- `SecretValue` cannot be serialized as ordinary JSON;
- no `eval`, executable reviver, dynamic class hydration, or schema-driven code loading is used;
- parser failures do not echo untrusted bodies;
- object payloads remain plain data and are not merged into application prototypes;
- media-type parsing rejects malformed tokens and ambiguous header values;
- decoding behavior does not depend on the process locale or platform default encoding.

Golden fixtures use canonical JSON comparison for cross-package conformance. Canonical comparison is a test utility and does not authorize production encoders to reorder protocol payloads.

## Rejected alternatives

### Serialize JSON inside each Adapter

Rejected because it duplicates UTF-8, validation, limits, error normalization, and platform behavior across integrations. It also prevents type-contract checks between protocol mapping and encoding.

### Parse JSON inside Transport

Rejected because Transport must remain wire- and domain-neutral. A byte Transport can then support JSON and future codecs without provider knowledge.

### Use Content-Type for late decoder discovery

Rejected because execution components must be frozen before I/O. Content-Type validates the selected decoder; it does not reconfigure the pipeline after a response arrives.

### Trust `JSON.stringify` coercion

Rejected because JavaScript silently omits or converts unsupported values and may invoke user code through getters or `toJSON`. The validated JSON contract must reject lossy inputs first.

### Accept invalid UTF-8 with replacement characters

Rejected because replacement can change field names, signatures, identifiers, and provider error details while hiding wire corruption.

### Include response text in parse errors

Rejected because payloads can contain prompts, personal data, provider details, or secrets, and because copying complete bodies defeats bounded diagnostic behavior.

### Make a binary codec the default

Rejected because the implemented integration and ecosystem contract are JSON-based. Additional codecs remain possible through the existing SPI once their requirements are implemented.

## Consequences

Positive consequences:

- the default text-unary path works without manual codec injection;
- Adapter, Codec, Transport, Authorization, and Runtime responsibilities remain separate;
- Browser, Worker, and Node use the same UTF-8 and error semantics;
- JSON behavior is independently contract-testable;
- malformed, incompatible, and oversized payloads fail deterministically;
- future codecs can replace JSON without changing domain or transport contracts.

Costs and trade-offs:

- payloads require runtime validation before native JSON serialization;
- strict UTF-8 and media-type handling may reject permissive provider behavior;
- decoding requires a bounded in-memory string for unary JSON;
- success and error decoder metadata is duplicated intentionally;
- default factories must explicitly compose the JSON package.

These costs are accepted for a deterministic, safe, and portable first release.

## Enforcement and review

This ADR is satisfied only when all applicable checks pass:

- Core packages import codec SPI only and do not import the concrete JSON package;
- `@evolutos/mconet-codec-json` imports SPI contracts but not Task, ServiceAccess, Authorization, provider integration, or Transport implementations;
- the default factory explicitly supplies the JSON encoder plus separate success and error decoders;
- encoder tests cover primitives, nested arrays/objects, Unicode, non-BMP text, emoji, empty strings, non-finite numbers, unsupported values, cycles, and side-effectful objects;
- decoder tests cover object, array, primitive, `null`, empty, whitespace-only, invalid UTF-8, malformed JSON, trailing data, and oversized payloads;
- media-type tests cover `application/json`, structured `+json` suffixes, parameters, casing, missing values, malformed values, incompatible types, and unsupported charsets;
- codec Contract Suites verify descriptors, type contracts, capabilities, bounded failures, and normalized errors;
- success and error decoders are selected before I/O and response headers cannot replace them;
- diagnostics, errors, monitoring, snapshots, and source maps contain no complete body or Secret;
- Golden Fixtures produce equivalent decoded values in Browser, Worker, and Node-supported environments;
- package and bundle checks prove no Node-only primitive leaks into the browser codec path.

Any proposal to change the default wire format, accept lossy JavaScript values, use non-UTF-8 default decoding, move JSON behavior into Transport or Adapter, or select decoders after I/O requires a new ADR that supersedes this decision.
