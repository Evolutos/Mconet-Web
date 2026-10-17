# Client API

The default and browser entries bind the browser Fetch transport. The node entry binds the Node Fetch transport. The three entries export the same names.

`interact` and `interactWithText` are the unary calls. The chat request sets `stream` to false and the response is one JSON body. `stream` and `streamText` are the server-stream calls on that same client. The chat request sets `stream` to true, `events` yields each new text fragment, and `output` is the assembled result. `interactWithTools` declares function tools, reads assistant `tool_calls`, runs the functions the caller registered, and sends each result back. It stops after four model calls. `client_stream`, `duplex`, and `long_running` are rejected before a credential is read.

| Name                             | Kind  |
| -------------------------------- | ----- |
| `ClientComponentSelection`       | type  |
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
