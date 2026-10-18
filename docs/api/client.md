# Client API

The default and browser entries bind the browser Fetch transport. The node entry binds the Node Fetch transport. The three entries export the same names.

`interact` and `interactWithText` are the unary calls. The chat request sets `stream` to false and the response is one JSON body. `stream` and `streamText` are the server-stream calls. `createOpenAICompatibleClient` installs `createOpenAIChatServerStreamReader` at construction, the chat request sets `stream` to true, Fetch opens the response body, and that reader yields each text fragment. `output` is the assembled result. `createDefaultClient` does not install a reader. `stream()` on that client fails with `missing_server_stream_reader` unless `components.serverStreamReader` is supplied. `interactWithTools` declares function tools, reads assistant tool calls, runs the functions the caller registered, and sends each result back. It stops after four model calls. A turn may also carry `images`: inline bytes or an http(s) or data URI. Each image is an `artifact.image` referenced by `content.artifact`. The runtime copies inline bytes and decodes data URIs locally. It fetches an http(s) URI, following redirects, without credentials and without the model API key, before it reads that credential. An `image/*` response Content-Type is kept. When that header is absent, a known image signature or the caller's image media type is used. The default chat adapter then writes OpenAI-compatible `image_url` parts. Callers that need Ollama `images` instead of OpenAI `image_url` parts inject `OllamaChatMessageRequestMapper` into the chat adapter. The body is still posted to `/chat/completions`. The default client does not install that mapper. Response image parts are recovered into the result artifact catalog. Audio, video, and file content are still rejected before a credential is read. `client_stream`, `duplex`, and `long_running` are rejected before a credential is read.

| Name                             | Kind  |
| -------------------------------- | ----- |
| `ClientComponentSelection`       | type  |
| `ConversationImage`              | type  |
| `ConversationMessage`            | type  |
| `ConversationTool`               | type  |
| `conversationRequest`            | value |
| `ConversationRequestInput`       | type  |
| `ConversationTaskBuilder`        | value |
| `createDefaultClient`            | value |
| `createOpenAICompatibleClient`   | value |
| `DefaultClientInput`             | type  |
| `DefaultModelClient`             | value |
| `DefaultModelClientDependencies` | type  |
| `ExecutableConversationTool`     | type  |
| `interactWithText`               | value |
| `interactWithTools`              | value |
| `mapClientComponents`            | value |
| `ModelClient`                    | type  |
| `ModelInteractor`                | type  |
| `OpenAICompatibleClientInput`    | type  |
| `projectConversationToolCalls`   | value |
| `RawResponseSnapshot`            | type  |
| `redactRawResponse`              | value |
| `streamText`                     | value |
| `TextStreamEvent`                | type  |
| `TextStreamInteraction`          | type  |
