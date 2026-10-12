# Error troubleshooting

Search this page for a `category`, `phase`, or `code` value from `ModelInteractionError`. The SDK reports these facts and does not retry the call.

## Categories

| Identifier                        | What to check                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `invalid_request`                 | The request shape or client lifecycle was rejected before a component ran.    |
| `invalid_component_configuration` | A component is missing its role method, or two declared ports do not connect. |
| `unsupported_feature`             | The selected component does not support the task, mode, or capability.        |
| `authentication`                  | The service rejected the credential.                                          |
| `permission`                      | The credential was accepted, but it is not allowed to make this call.         |
| `rate_limit`                      | The service asked the caller to wait. The SDK does not retry.                 |
| `content_filter`                  | The service refused the content.                                              |
| `context_length`                  | The prompt is larger than the service allows.                                 |
| `timeout`                         | The deadline elapsed.                                                         |
| `cancelled`                       | The caller aborted the signal.                                                |
| `network`                         | The transport failed before a usable service response.                        |
| `serialization`                   | The request payload could not be encoded.                                     |
| `deserialization`                 | The response bytes could not be decoded.                                      |
| `protocol`                        | The decoded payload does not match the adapter protocol.                      |
| `model_service`                   | The service returned an error response.                                       |
| `unknown`                         | The failure did not match a standard category.                                |

## Phases

| Identifier         | What to check                                        |
| ------------------ | ---------------------------------------------------- |
| `validation`       | Request fields and client state.                     |
| `resolution`       | Which component or service access was selected.      |
| `planning`         | The adapter plan.                                    |
| `encoding`         | The payload encoder.                                 |
| `authorization`    | Credential read and header application.              |
| `transport`        | The send operation.                                  |
| `decoding`         | Response size and the payload decoder.               |
| `response_parsing` | The adapter's interpretation of the decoded payload. |

## Codes

| Identifier                        | What to check                                                      |
| --------------------------------- | ------------------------------------------------------------------ |
| `unsupported_model_integration`   | No integration supports the requested target.                      |
| `ambiguous_model_integration`     | More than one integration supports the requested target.           |
| `unsupported_task`                | The adapter rejected the task type.                                |
| `unsupported_message_content`     | A message part is outside the supported content set.               |
| `unsupported_interaction_mode`    | The requested mode is not available on this path.                  |
| `unsupported_capability`          | A required component capability is missing.                        |
| `invalid_component_type_contract` | Adjacent components declare ports that do not connect.             |
| `component_type_mismatch`         | A produced type is not the type the next component accepts.        |
| `component_not_found`             | A required component role was not supplied.                        |
| `ambiguous_component_selection`   | More than one component matches the required role.                 |
| `artifact_reference_not_found`    | The response refers to an artifact that is not in the catalog.     |
| `duplicate_artifact_id`           | Two artifacts use the same id.                                     |
| `response_body_too_large`         | The response exceeded the configured byte limit and was cancelled. |
| `client_closed`                   | `close` already ran, so the client rejects a new request.          |
| `raw_response_too_large`          | The opt-in raw response exceeded the response byte limit.          |
