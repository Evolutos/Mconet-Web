# R1 scope

This file is the frozen R1 scope. A change to the supported or rejected set below is an explicit scope review.

## Supported

| Dimension           | Supported value                                                                       |
| ------------------- | ------------------------------------------------------------------------------------- |
| Task                | `conversation.generate`                                                               |
| Message             | `system`, `user`, `assistant`, text content                                           |
| Mode                | `unary`, `server_stream`                                                              |
| Wire format         | JSON                                                                                  |
| Transport           | HTTP and HTTPS `fetch`                                                                |
| Authorization       | no authorization, header API key, Bearer                                              |
| Default integration | one OpenAI-compatible text protocol                                                   |
| Configuration       | client defaults plus one call override                                                |
| Output              | text, server-stream text fragments, finish reason, usage, model and response metadata |

## Rejected

| Dimension     | Rejected value                                                 |
| ------------- | -------------------------------------------------------------- |
| Task          | embedding, rerank, image, audio, video, custom binary tasks    |
| Message       | tool, image, audio, video, and file content                    |
| Mode          | `client_stream`, `duplex`, `long_running`                      |
| Wire format   | Protobuf, XML, custom binary                                   |
| Transport     | WebSocket, WebTransport, gRPC                                  |
| Authorization | automatic OAuth refresh, body or chunk signatures              |
| Integration   | guessing among provider protocols                              |
| Configuration | a global mutable registry or changing components during a call |
| Output        | artifacts, operation handles                                   |

Rejected task, message content, and mode values fail with a stable error before a credential is read and before network I/O.

## Not included

- automatic retry, backoff, circuit breaking, load balancing, and business rate limits
- automatic model or protocol switching
- an agent loop and actual tool execution
- session persistence, history trimming, long-term memory, and retrieval
- automatic repair of a business schema
- placing a long-lived model credential in the browser by default
- a public component registry, component ids, dynamic binding registration, and hot-loaded plugins
- an untyped hook or universal interceptor reserved for a future capability
