# Mconet Web SDK

Protocol-driven TypeScript SDK for one model interaction at a time, on Node.js and in the browser. Core does not bind itself to a vendor. A call names a service, a protocol, and a model. An adapter for that protocol plans, encodes, and reads the exchange. The built-in adapter speaks OpenAI-compatible chat. Another model is reached by supplying that model's adapter to the same pipeline.

The public entry is [`@evolutos/mconet-client`](packages/client). Domain values stay open so a new protocol can reuse them. Components are instances the caller passes in. There is no global component registry, and a call does not change the components of a later call.

## Requirements

- Node.js `20.19+`, `22.13+`, or `24+`
- ESM (`"type": "module"`)
- A Fetch implementation: the browser entry uses browser Fetch; the Node entry uses Node Fetch

This repository uses pnpm `11+`.

## Install

The SDK packages are private workspace packages. They are consumed from this repository after a build. Package exports point at `dist/`.

```bash
pnpm install
pnpm build
```

An application package in this workspace depends on the client:

```json
{
  "dependencies": {
    "@evolutos/mconet-client": "workspace:*"
  }
}
```

```ts
import { createOpenAICompatibleClient, interactWithText } from "@evolutos/mconet-client";
```

Package exports select the transport before any request exists:

| Condition | Module            | Transport     |
| --------- | ----------------- | ------------- |
| `node`    | `dist/node.js`    | Node Fetch    |
| `browser` | `dist/browser.js` | Browser Fetch |
| default   | `dist/index.js`   | Browser Fetch |

Both entries export the same names. A bundler that sets the `browser` condition never loads the Node transport.

## Packages

| Package                                          | Role                                                          |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `@evolutos/mconet-client`                        | Public client: factories, text helpers, and the call surface  |
| `@evolutos/mconet-core-domain`                   | Requests, messages, artifacts, errors, and result projections |
| `@evolutos/mconet-core-spi`                      | Replaceable component contracts                               |
| `@evolutos/mconet-core-runtime`                  | One interaction pipeline                                      |
| `@evolutos/mconet-auth-basic`                    | No authorization, header API key, and Bearer                  |
| `@evolutos/mconet-codec-json`                    | JSON encode and decode                                        |
| `@evolutos/mconet-integration-openai-compatible` | Chat-completions adapter, stream reader, and message mappers  |
| `@evolutos/mconet-transport-fetch-browser`       | Browser Fetch transport                                       |
| `@evolutos/mconet-transport-fetch-node`          | Node Fetch transport                                          |
| `@evolutos/mconet-testing`                       | Stubs, a fake clock, and a recording transport for tests      |

The symbol index is [`docs/api/public-api.md`](docs/api/public-api.md). The client surface is [`docs/api/client.md`](docs/api/client.md).

## Capabilities

One pipeline accepts every call:

```text
ModelRequest
→ validate the task, messages, and mode
→ select the adapter from protocolId
→ prepare a plan with no I/O
→ encode, authorize, and send
→ decode the response
→ ModelOutput
```

`ModelTarget` keeps the three identities apart. `serviceId` names the service, `protocolId` selects the adapter, and `model` is the model that adapter sends. A model name does not select a protocol, and the SDK does not guess one from an endpoint.

A new protocol reuses those open identifiers, then supplies a `TaskProtocolAdapter`. Codecs, transport, and authorization are separate instances on the same call. The execution gate below is what this release will send.

### What this release sends

| Dimension            | This release                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task                 | `conversation.generate`                                                                                                                              |
| Text                 | `system`, `user`, `assistant`, and `tool` text                                                                                                       |
| Images               | `artifact.image` referenced by `content.artifact`. Inline bytes, an absolute `http:` or `https:` URL, or a base64 `data:image` URI                   |
| Tools                | Function declarations on the task. Assistant function calls on messages. The caller runs the function and sends the result as a later `tool` message |
| Mode                 | `unary` and `server_stream`                                                                                                                          |
| Wire format          | JSON                                                                                                                                                 |
| Transport            | HTTP and HTTPS Fetch                                                                                                                                 |
| Authorization        | None, one named API-key header, or Bearer                                                                                                            |
| Built-in integration | OpenAI-compatible chat completions. `protocolId` is `openai.chat.completions`                                                                        |
| Configuration        | Client defaults, plus one override on a single call                                                                                                  |
| Output               | Assistant text, image artifacts recovered from the response, server-stream text fragments, finish reason, token usage, and model metadata            |

`interact` and `stream` accept that set. Another content kind or artifact kind, including `artifact.audio` and `artifact.video`, fails before a credential is read and before the adapter runs. `ArtifactKind.id` stays an open identifier, so application data can store those values. This release does not send them.

Any other model that can carry this conversation uses the same client. Pass its `TaskProtocolAdapter` to `createDefaultClient`. The adapter's `supports` matches `protocolId`, task type, and mode. When its payload ports differ from `json.value`, pass codecs with those ports as well. `createOpenAICompatibleClient` is the built-in composition for chat completions, not a closed set of models.

Default byte limits, used when a call does not override them:

| Limit                        | Bytes      |
| ---------------------------- | ---------- |
| `maxResponseBodyBytes`       | 16,777,216 |
| `maxStreamingErrorBodyBytes` | 1,048,576  |
| `maxFrameBytes`              | 2,097,152  |

An inline image is accepted up to 20,971,520 bytes. The image read runs before the model credential is read. An `http:` or `https:` image is fetched without credentials and without the model API key. Redirects on that image fetch are followed. The model transport still refuses redirects, so an API key is not replayed.

## Quick start

```ts
import { bearerAuthorizationKind } from "@evolutos/mconet-auth-basic";
import { createOpenAICompatibleClient, interactWithText } from "@evolutos/mconet-client";
import {
  projectConversationText,
  SecretValue,
  type ConversationTaskResult,
  type ModelOutput,
} from "@evolutos/mconet-core-domain";
import type { CredentialSource } from "@evolutos/mconet-core-spi";

const target = {
  serviceId: "provider.example",
  protocolId: "openai.chat.completions",
  model: { name: "vendor-model", metadata: {}, extensions: {} },
  extensions: {},
} as const;

const apiKey = process.env.VENDOR_API_KEY;
if (apiKey === undefined || apiKey.length === 0) {
  throw new Error("VENDOR_API_KEY must be set.");
}

const credentialSource: CredentialSource = {
  getCredential: () => Promise.resolve(new SecretValue(apiKey)),
};

const client = createOpenAICompatibleClient({
  target,
  serviceAccess: {
    endpoint: { kind: "absolute", value: "https://provider.example.test/v1" },
    authorization: { kind: bearerAuthorizationKind, credentialSource },
    headers: [],
    query: [],
    extensions: {},
  },
});

const output = await interactWithText(client, {
  target,
  messages: [{ role: "user", text: "Hello" }],
});

console.log(conversationText(output));
await client.close();

function conversationText(output: ModelOutput): string {
  const result = output.result;
  if (result.descriptor.type !== "conversation.generate" || !("messages" in result)) {
    throw new TypeError("Expected a conversation.generate result.");
  }
  return projectConversationText(result as ConversationTaskResult);
}
```

`createOpenAICompatibleClient` stores the target and service access as client defaults, installs the chat-completions resolver, the chat JSON ports, `createOpenAIChatServerStreamReader`, and the three authorization handlers. The service-access `kind` selects one handler. The chat request path is `/chat/completions`, joined to the endpoint by the runtime. Put the API base in `endpoint`, for example `https://provider.example.test/v1`.

`interact` and `interactWithText` send `stream: false` and return one assembled output. `stream` and `streamText` on this client send `stream: true` and use the reader installed above.

## Calls

### Unary text

```ts
import { interactWithText } from "@evolutos/mconet-client";

const output = await interactWithText(client, {
  target,
  messages: [
    { role: "system", text: "Answer in one sentence." },
    { role: "user", text: "What is a protocol identifier?" },
  ],
});
```

`conversationRequest` builds the same envelope without sending it. Task validation stays in `ConversationTaskBuilder`. Envelope validation stays in `ModelRequestBuilder`.

```ts
import { conversationRequest } from "@evolutos/mconet-client";

const request = conversationRequest({
  target,
  messages: [{ role: "user", text: "Hello" }],
});
const output = await client.interact(request);
```

A conversation result carries assistant text, a finish reason, and usage when the service reports them.

```ts
output.status; // "completed" when generation finished
output.stopReason; // provider finish reason, such as "stop"
output.usage; // { inputTokens, outputTokens, totalTokens, extensions }
```

`status` is one of `completed`, `requires_action`, `incomplete`, `refused`, `filtered`, `cancelled`, `failed`, `unknown`, or an integration-defined identifier. `projectConversationText` concatenates assistant text in document order. Other roles stay in the message document.

### Server stream

```ts
import { streamText } from "@evolutos/mconet-client";

const interaction = streamText(client, {
  target,
  messages: [{ role: "user", text: "Hello" }],
});

for await (const event of interaction.events) {
  process.stdout.write(event.text);
}

const output = await interaction.output;
```

Use a client from `createOpenAICompatibleClient`. That factory installs `createOpenAIChatServerStreamReader` before the first call. `stream()` sets the mode to `server_stream`, Fetch opens the response body, and that reader yields each new text fragment. Earlier fragments are not repeated. `output` is the assembled result. Waiting on `output` does not require the caller to drain `events`.

`createDefaultClient` does not install a reader. `stream()` on that client fails with `missing_server_stream_reader` unless `components.serverStreamReader` is passed to the factory or to that call. The streaming tests construct `createOpenAICompatibleClient`, so the reader is already on the client.

### Tools

A tool declaration is a name, an optional description, and a JSON Schema object. `interactWithTools` runs only functions registered on that call. Each round is one `interact`. Continuation requires status `requires_action`, one assistant entry that requested tools, and a registered `execute` for every requested name. `execute` receives the model's raw argument text and returns the result text. The helper appends that text as a tool message and stops after four model calls. A response that names an unregistered function, or that still asks for tools on the fourth model call, is returned as-is. The helper does not parse arguments.

```ts
import { interactWithTools } from "@evolutos/mconet-client";

const output = await interactWithTools(client, {
  target,
  messages: [{ role: "user", text: "What is the weather in Shanghai?" }],
  tools: [
    {
      name: "get_weather",
      description: "Weather for a city.",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
      execute(argumentsText) {
        return JSON.stringify({ city: argumentsText, condition: "cloudy" });
      },
    },
  ],
});
```

`interactWithText` does not run functions. When the assistant asks for one, `status` is `requires_action`. Append a `tool` message that repeats the call id, and send the conversation again.

```ts
import { interactWithText, projectConversationToolCalls } from "@evolutos/mconet-client";
import { projectConversationText, type ConversationTaskResult } from "@evolutos/mconet-core-domain";

const tools = [
  {
    name: "get_weather",
    description: "Weather for a city.",
    parameters: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
  },
];

const first = await interactWithText(client, {
  target,
  tools,
  messages: [{ role: "user", text: "What is the weather in Shanghai?" }],
});

const calls = projectConversationToolCalls(first.result as ConversationTaskResult);
const call = calls[0];
if (call === undefined) {
  console.log(projectConversationText(first.result as ConversationTaskResult));
} else {
  const weather = JSON.stringify({ city: "Shanghai", condition: "cloudy" });
  const second = await interactWithText(client, {
    target,
    tools,
    messages: [
      { role: "user", text: "What is the weather in Shanghai?" },
      { role: "assistant", text: "", toolCalls: [call] },
      { role: "tool", text: weather, toolCallId: call.id },
    ],
  });
  console.log(projectConversationText(second.result as ConversationTaskResult));
}
```

`call.arguments` is the model's raw JSON text. The SDK does not parse it, repair it, or invent a function the caller did not declare.

### Images

Set `bytes` or `uri` on each image, and exactly one of them. Inline bytes require an image media type such as `image/png`. A URI is an absolute `http:` or `https:` URL without userinfo, or a base64 `data:image/...;base64,...` URI.

```ts
await interactWithText(client, {
  target,
  messages: [
    {
      role: "user",
      text: "Describe this image.",
      images: [
        { mediaType: "image/png", bytes: pngBytes },
        { uri: "https://cdn.example.test/chart.png" },
      ],
    },
  ],
});
```

Each image becomes an `artifact.image` and a `content.artifact` reference after the text segment. The default chat adapter writes OpenAI-compatible `image_url` parts. Response image parts are recovered into the result artifact catalog.

### Sampling controls

`interactWithText` and `conversationRequest` leave generation controls off the task. To send them, add a `task.configuration` leaf beside the conversation input. The chat adapter maps these fields onto the chat-completions body:

| Domain field      | Wire field    | Constraint on this protocol                                                                                                           |
| ----------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `temperature`     | `temperature` | `0` through `2`, copied exactly. The default policy is `compatible`: a value outside that range is omitted. `strict` rejects the call |
| `topP`            | `top_p`       | `0` through `1`                                                                                                                       |
| `maxOutputTokens` | `max_tokens`  | Positive safe integer                                                                                                                 |
| `stop`            | `stop`        | Non-empty strings, in order                                                                                                           |
| `seed`            | `seed`        | Safe integer                                                                                                                          |

```ts
{
  id: "parameters",
  kind: "task.configuration",
  composition: "leaf",
  parameters: {
    temperature: 0,
    topP: 1,
    maxOutputTokens: 256,
    stop: ["END"],
    seed: 7,
  },
  relations: [],
  metadata: {},
  extensions: {},
}
```

Place that node in `task.document.root.children` next to the `task.input.conversation` leaf, then build the task with `ConversationTaskBuilder` and the envelope with `ModelRequestBuilder` from `@evolutos/mconet-core-domain`.

### Cancellation, deadlines, and limits

Options apply to one call. They are not written back onto the client.

```ts
const controller = new AbortController();

await interactWithText(
  client,
  { target, messages: [{ role: "user", text: "Hello" }] },
  {
    signal: controller.signal,
    deadline: Date.now() + 30_000,
    resourceLimits: { maxResponseBodyBytes: 1_048_576 },
    serviceAccessOverride: {
      endpoint: { kind: "absolute", value: "https://provider.example.test/v1" },
      authorization: { kind: bearerAuthorizationKind, credentialSource },
      headers: [],
      query: [],
      extensions: {},
    },
  },
);
```

`deadline` is a Unix epoch timestamp in milliseconds, and it must be a safe integer. `serviceAccessOverride` is the highest service-access layer for that call. A field it supplies wins over the same field on the request and on the client default. Authorization is taken as one description. Headers and query each use the highest non-empty list. A call resource limit replaces the matching client limit for that field, then the SDK default.

### Raw response

Set `includeRawResponse: true` to keep a sanitized copy of the response bytes and metadata. The copy is bounded by the response byte limit. A larger body fails with code `raw_response_too_large` and is not attached.

```ts
const output = await client.interact(request, { includeRawResponse: true });
const snapshot = output.rawResponse;
```

`redactRawResponse`, exported from the client, is the sanitizer the snapshot uses.

## Authorization

Authorization is a description plus a credential source. The secret stays inside `SecretValue` until a handler calls `expose` for that request. Implicit string conversion of a `SecretValue` is `[REDACTED]`.

| Kind                           | Import                          | What the description carries                                                                        |
| ------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `authorization.none`           | `noAuthorizationKind`           | No credential                                                                                       |
| `authorization.bearer`         | `bearerAuthorizationKind`       | `credentialSource`. The handler writes header `authorization` with the value `Bearer` and the token |
| `authorization.api-key-header` | `apiKeyHeaderAuthorizationKind` | `headerName` and `credentialSource`                                                                 |

```ts
import { apiKeyHeaderAuthorizationKind } from "@evolutos/mconet-auth-basic";
import { SecretValue } from "@evolutos/mconet-core-domain";
import type { CredentialSource } from "@evolutos/mconet-core-spi";

const credentialSource: CredentialSource = {
  async getCredential() {
    return new SecretValue(await readKeyFromYourVault());
  },
};

const authorization = {
  kind: apiKeyHeaderAuthorizationKind,
  headerName: "x-api-key",
  credentialSource,
};
```

`getCredential` may return a fixed, rotating, or remotely loaded secret. The runtime calls it for each interaction that needs it. Refresh, caching, and persistence stay in the source.

`createOpenAICompatibleClient` installs all three handlers. `createDefaultClient` installs only the no-authorization handler until `components.authorizationHandlers` replaces that list.

### Where the credential lives

A long-lived vendor key belongs in a server process. Two browser arrangements are in [`examples/`](examples):

- [`examples/browser-bff`](examples/browser-bff) calls a same-origin backend. The page uses `authorization.none`. The endpoint is the `/bff` base; the chat plan appends `/chat/completions`. The server process reads `VENDOR_API_KEY` and does not write it into the response.
- [`examples/browser-direct-ephemeral-token`](examples/browser-direct-ephemeral-token) calls the provider from the page with a short-lived, revocable, user-scoped token. The provider must allow this origin, including the authorization header. The token is supplied at the call. It is not written into the module, the page source, or browser storage.

[`examples/node-server`](examples/node-server) reads `VENDOR_API_KEY` from the server environment.

## Errors

A failed interaction throws `ModelInteractionError` from `@evolutos/mconet-core-domain`. The SDK reports the failure and does not retry. Building an invalid conversation throws `TypeError` before a call starts. A deadline that is not a safe integer also throws `TypeError`.

| Field              | Meaning                                                                             |
| ------------------ | ----------------------------------------------------------------------------------- |
| `category`         | High-level class, such as `authentication`, `rate_limit`, `timeout`, or `cancelled` |
| `phase`            | Pipeline stage, such as `validation`, `authorization`, or `transport`               |
| `code`             | Stable machine-readable code, such as `client_closed` or `unsupported_task`         |
| `statusCode`       | HTTP-style status when the service sent one                                         |
| `serviceErrorCode` | Provider code, preserved as reported                                                |
| `requestId`        | Service correlation id when reported                                                |
| `recovery`         | Optional `transient`, `retryAfterMilliseconds`, and `requestMayHaveBeenProcessed`   |
| `diagnostics`      | Technical observations for this failure                                             |
| `cause`            | Original failure, typed as `unknown`                                                |

```ts
import { ModelInteractionError } from "@evolutos/mconet-core-domain";

try {
  await interactWithText(client, { target, messages: [{ role: "user", text: "Hello" }] });
} catch (error) {
  if (error instanceof ModelInteractionError && error.category === "rate_limit") {
    const waitMs = error.recovery?.retryAfterMilliseconds;
    // The application decides whether to wait and call again.
    void waitMs;
  }
  throw error;
}
```

Category, phase, and code tables are in [`docs/errors/troubleshooting.md`](docs/errors/troubleshooting.md). `message` is a technical summary. It is not end-user copy.

After `close()`, a new `interact` or `stream` throws `ModelInteractionError` with code `client_closed`. A second `close()` resolves. The public factories do not register components for release, so `close()` leaves the Fetch transport and injected components open.

## Customize, extend, and inject

A model that is not the built-in chat binding enters through the same client. Pass its `TaskProtocolAdapter` when the client is created, or on one call. Pass codecs, a transport, or authorization handlers when that protocol needs different ports or credentials. Construction checks that each supplied component exposes the method its role requires. It does not call that method. Adjacent components must declare ports that connect. A port mismatch fails with `invalid_component_type_contract` or `component_type_mismatch` before the request is sent.

The current gate still requires `conversation.generate` with text and images before those components run. An adapter for another model maps that conversation onto its own JSON HTTP plan. Audio and video stay on the open `ArtifactKind.id` in application data. This call does not receive them.

There is no plugin registry and no component id lookup. Supply the object itself.

### Precedence

1. `options.components` on one `interact` or `stream` call.
2. `components` and `adapter` passed to `createDefaultClient`.
3. The factory defaults in the next section.

A call field replaces the client field for that role. It does not merge with it. Authorization handlers are an ordered candidate list. The resolver picks the one handler whose kind matches the service access.

### Default implementations

`createDefaultClient` fills every omitted role below. `createOpenAICompatibleClient` starts from that client and replaces the roles in the second column. A role you pass in `components` or `adapter` replaces that column for the client. A role you pass on one call replaces it for that call.

| Role                           | `createDefaultClient`                                                                   | `createOpenAICompatibleClient`                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `transport`                    | `BrowserFetchTransport` or `NodeFetchTransport`, bound to `globalThis.fetch`            | Same platform Fetch transport                                                                         |
| `taskProtocolAdapter`          | None. Pass `adapter` or a resolver                                                      | None on the client. The resolver returns `createOpenAIChatCompletionAdapter()`                        |
| `modelIntegrationResolver`     | None                                                                                    | `createOpenAIChatIntegrationResolver`                                                                 |
| `payloadEncoder`               | `JsonPayloadEncoder`. Port `json.value` to `codec.bytes`                                | Chat wrapper around `JsonPayloadEncoder`. Port `protocol.openai.chat-request` to `codec.bytes`        |
| `successPayloadDecoder`        | `JsonSuccessPayloadDecoder`, limit 16,777,216 bytes. Port `codec.bytes` to `json.value` | Chat wrapper around that decoder. Port `codec.bytes` to `protocol.openai.chat-response`               |
| `errorPayloadDecoder`          | `JsonErrorPayloadDecoder`, limit 16,777,216 bytes. Port `codec.bytes` to `json.value`   | Same `JsonErrorPayloadDecoder`                                                                        |
| `serverStreamReader`           | None. `stream()` fails with `missing_server_stream_reader`                              | `createOpenAIChatServerStreamReader`, installed at construction. `stream()` and `streamText()` use it |
| `authorizationHandlers`        | `NoAuthorizationHandler`                                                                | `NoAuthorizationHandler`, `ApiKeyHeaderAuthorizationHandler`, `BearerAuthorizationHandler`            |
| `authorizationHandlerResolver` | Runtime `DefaultAuthorizationHandlerResolver`                                           | Same runtime resolver                                                                                 |
| `serviceAccessResolver`        | Runtime `DefaultServiceAccessResolver`                                                  | Same runtime resolver                                                                                 |

JSON codecs come from `@evolutos/mconet-codec-json`. Authorization handlers come from `@evolutos/mconet-auth-basic`. The chat adapter, its resolver, and the server-stream reader come from `@evolutos/mconet-integration-openai-compatible`. The two runtime resolvers come from `@evolutos/mconet-core-runtime`. Fetch transports are chosen by the client export condition.

The chat adapter maps messages to OpenAI `image_url` parts. It has no separate message-mapper component until you pass one to `createOpenAIChatCompletionAdapter`. The default interaction mode is `unary`. On `createOpenAICompatibleClient`, `stream()` selects `server_stream` and reads the response with the installed `createOpenAIChatServerStreamReader`. The compatibility policy is `compatible` when the client and the call both omit one.

`DefaultAuthorizationHandlerResolver` keeps the one handler whose `supports` matches the authorization kind. `DefaultServiceAccessResolver` merges the call override, the request, the client default, and the integration default. The two runtime resolvers are used when the client does not pass `authorizationHandlerResolver` or `serviceAccessResolver`.

A `taskProtocolAdapter` skips integration resolution. A `modelIntegrationResolver` runs when no adapter is present. `createDefaultClient` requires one of the two. `createOpenAICompatibleClient` installs the chat resolver, so the call's `protocolId`, task type, and mode select the chat adapter. The model name is unread.

`clientConfiguration` on `createDefaultClient` stores reusable defaults: `defaultTarget`, `defaultServiceAccess`, `defaultCompatibilityPolicy`, and `defaultResourceLimits`. A request target and a call's `serviceAccessOverride` sit above those defaults.

### Replace the transport

A custom transport implements `Transport` from `@evolutos/mconet-core-spi`. With the default JSON codecs, the port is `codec.bytes` in and `codec.bytes` out, and the output media type is `application/json`. `close()` does not release an injected transport. The public factories also do not register the default Fetch transport for release, so `close()` stops new calls and leaves that transport open.

```ts
import { createDefaultClient } from "@evolutos/mconet-client";
import type { TaskProtocolAdapter, Transport } from "@evolutos/mconet-core-spi";

const json = { type: "application", subtype: "json", parameters: {} } as const;

const transport: Transport = {
  descriptor: {
    name: "counting-transport",
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
    typeContract: {
      inputTypeId: "codec.bytes",
      outputTypeId: "codec.bytes",
      outputMediaTypes: [json],
    },
  },
  async send() {
    return {
      metadata: {
        outcome: "success",
        statusCode: 200,
        headers: [],
        mediaType: json,
        extensions: {},
      },
      body: new TextEncoder().encode("{}"),
    };
  },
};

declare const adapter: TaskProtocolAdapter;

const client = createDefaultClient({
  adapter,
  components: { transport },
});
```

`adapter` is the `TaskProtocolAdapter` for the target protocol. A per-call replacement uses the same transport object on the call:

```ts
await client.interact(request, { components: { transport } });
```

A streaming transport also implements `open` and returns an async iterable of frames. The server-stream reader consumes those frames. [`examples/custom-transport`](examples/custom-transport) injects a transport that implements `send`.

### Replace the protocol adapter

`TaskProtocolAdapter` is how a model's protocol joins the pipeline. It matches `protocolId`, prepares a plan, builds an unencoded payload, and parses a decoded success or error. It does not read credentials, encode bytes, authorize, or send. `parseError` returns a `ModelInteractionError`. This release has already limited the request to `conversation.generate` with text and images.

`preparePlan` returns a `ProtocolExecutionPlan`: endpoint, path, method, headers, the authorization description, and the encoder, decoder, and transport requirements. `parseResponse` returns a `ParsedTaskResponse`. A direct adapter that speaks JSON can use payload type id `json.value` with the default codecs. The worked example is [`examples/custom-adapter`](examples/custom-adapter). Pass that adapter to `createDefaultClient({ adapter })`.

To select among adapters yourself, pass `components.modelIntegrationResolver` instead of `adapter`. `resolve` returns one `ModelIntegrationPlan` whose `taskProtocolAdapter` handles that target. More than one match is `ambiguous_model_integration`. No match is `unsupported_model_integration`.

### Inject a message mapper

The chat adapter writes OpenAI `image_url` parts unless a `MessageRequestMapper` is supplied. `OllamaChatMessageRequestMapper` replaces that message list: text stays in `content`, and image bytes are base64 payloads in `images`. The request is still the chat-completions body posted to `/chat/completions`. The mapper does not change the path, does not fetch a URL, and does not accept audio or video. Image sources are already inline bytes when it runs. A remote URL still present at mapping time fails with `unsupported_artifact_source`.

`createOpenAICompatibleClient` builds its adapter without a mapper. Pass an explicit adapter to `createDefaultClient`, and pair it with codecs whose ports are the chat protocol ports. The generic `json.value` codecs do not connect to those ports. The error decoder can stay the default JSON decoder.

```ts
import {
  ApiKeyHeaderAuthorizationHandler,
  BearerAuthorizationHandler,
  NoAuthorizationHandler,
} from "@evolutos/mconet-auth-basic";
import { createDefaultClient } from "@evolutos/mconet-client";
import {
  JsonPayloadEncoder,
  JsonSuccessPayloadDecoder,
  jsonPayloadEncoderCapabilityId,
} from "@evolutos/mconet-codec-json";
import type { PayloadDecoder, PayloadEncoder } from "@evolutos/mconet-core-spi";
import {
  createOpenAIChatCompletionAdapter,
  createOpenAIChatServerStreamReader,
  OllamaChatMessageRequestMapper,
  OPENAI_CHAT_REQUEST_TYPE_ID,
  OPENAI_CHAT_RESPONSE_TYPE_ID,
} from "@evolutos/mconet-integration-openai-compatible";

const json = { type: "application", subtype: "json", parameters: {} } as const;
const maxBodyBytes = 16_777_216;

const payloadEncoder: PayloadEncoder = {
  descriptor: {
    name: "chat-json-encoder",
    version: "1.0.0",
    capabilities: new Set([jsonPayloadEncoderCapabilityId]),
    source: "application",
    typeContract: {
      inputTypeId: OPENAI_CHAT_REQUEST_TYPE_ID,
      outputTypeId: "codec.bytes",
    },
  },
  encode: (value, context) => new JsonPayloadEncoder().encode(value, context),
};

const successDecoder = new JsonSuccessPayloadDecoder(maxBodyBytes);
const successPayloadDecoder: PayloadDecoder = {
  descriptor: {
    name: "chat-json-success-decoder",
    version: "1.0.0",
    capabilities: new Set(),
    source: "application",
    typeContract: {
      inputTypeId: "codec.bytes",
      outputTypeId: OPENAI_CHAT_RESPONSE_TYPE_ID,
      inputMediaTypes: [json],
      outputMediaTypes: [json],
    },
  },
  async decode(bytes, context) {
    const decoded = await successDecoder.decode(bytes, context);
    return { typeId: OPENAI_CHAT_RESPONSE_TYPE_ID, value: decoded.value };
  },
};

const client = createDefaultClient({
  adapter: createOpenAIChatCompletionAdapter({
    messageRequestMapper: new OllamaChatMessageRequestMapper(),
  }),
  clientConfiguration: {
    defaultTarget: target,
    defaultServiceAccess: serviceAccess,
  },
  components: {
    payloadEncoder,
    successPayloadDecoder,
    serverStreamReader: createOpenAIChatServerStreamReader(),
    authorizationHandlers: [
      new NoAuthorizationHandler(),
      new ApiKeyHeaderAuthorizationHandler(),
      new BearerAuthorizationHandler(),
    ],
  },
});
```

A mapper implements `MessageRequestMapper`: `descriptor` plus `mapRequest(document, catalog)` returning `{ typeId, value }`. `value` must be JSON message objects. Tools, sampling, and the model field stay on the chat builder.

### Supply a credential source

Any object with `getCredential(context): Promise<SecretValue>` is a `CredentialSource`. `context.signal` is the interaction abort signal. Reject the promise on provider failure or cancellation. The source does not retry.

Dynamic and fixed helpers are also exported from `@evolutos/mconet-auth-basic` as `DynamicCredentialSource` and `FixedCredentialSource`.

### Other replaceable roles

Pass any of these on `components` at the client or on one call:

The concrete classes for each role are in [Default implementations](#default-implementations). The contracts are:

| Field                          | Contract                       | Role                                            |
| ------------------------------ | ------------------------------ | ----------------------------------------------- |
| `taskProtocolAdapter`          | `TaskProtocolAdapter`          | Protocol match, plan, request, and response     |
| `modelIntegrationResolver`     | `ModelIntegrationResolver`     | Choose one adapter from the target              |
| `payloadEncoder`               | `PayloadEncoder`               | Unencoded payload to bytes                      |
| `successPayloadDecoder`        | `PayloadDecoder`               | Success bytes to a typed value                  |
| `errorPayloadDecoder`          | `PayloadDecoder`               | Error bytes to a typed value                    |
| `transport`                    | `Transport`                    | Send the authorized request                     |
| `serverStreamReader`           | `ServerStreamReader`           | Read a `server_stream` body into text fragments |
| `authorizationHandlers`        | `AuthorizationHandler[]`       | Candidates selected by authorization kind       |
| `authorizationHandlerResolver` | `AuthorizationHandlerResolver` | Pick exactly one handler                        |
| `serviceAccessResolver`        | `ServiceAccessResolver`        | Merge request and configured access             |

Each component carries a `descriptor`: `name`, `version`, `capabilities`, `source` (`"builtin"`, `"plugin"`, or `"application"`), and an optional `typeContract`. Name and version are diagnostic. They are not lookup keys.

`source: "application"` marks a caller-owned instance. `close()` stops new requests. It does not call `close` on injected components, and the public factories do not hand it a set of SDK-created components to release.

The scope of this client is [`spec/r1-scope.md`](spec/r1-scope.md).

## Examples

| Example                                                                              | What it shows                                                                |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| [`examples/node-server`](examples/node-server)                                       | `createOpenAICompatibleClient` on Node, with a server-held Bearer credential |
| [`examples/browser-bff`](examples/browser-bff)                                       | Browser client aimed at a same-origin backend                                |
| [`examples/browser-direct-ephemeral-token`](examples/browser-direct-ephemeral-token) | Browser client with a short-lived token                                      |
| [`examples/custom-adapter`](examples/custom-adapter)                                 | A direct `TaskProtocolAdapter` beside an in-memory transport                 |
| [`examples/custom-transport`](examples/custom-transport)                             | A transport injected through `components`                                    |

## Develop this repository

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

`pnpm build` emits declarations and ESM into each package `dist/`. `pnpm test` runs the Vitest workspace. Contract, conformance, and browser-transport suites have their own scripts in the root `package.json`.

## Further reading

- [Client API](docs/api/client.md)
- [Public API index](docs/api/public-api.md)
- [Error troubleshooting](docs/errors/troubleshooting.md)
- [R1 scope](spec/r1-scope.md)

## License

Copyright © 2026 Mcont. The packages in this repository are `UNLICENSED`.
