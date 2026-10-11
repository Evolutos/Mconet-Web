// Copyright © 2026 Mcont.

import type {
  CompatibilityPolicy,
  InteractionMode,
  ModelRequest,
  ProcessingResult,
} from "@evolutos/mconet-core-domain";
import type { ProtocolExecutionPlan } from "@evolutos/mconet-core-spi";

import { matchesUnaryInteractionMode } from "./match-interaction-mode.js";
import { matchesOpenAIChatCompletionsProtocol } from "./match-protocol-id.js";
import { matchesConversationGenerateTask } from "./match-task-type.js";

/** Stable code when the target protocol is not chat completions. */
const unsupportedProtocolCode = "unsupported_protocol";

/** Stable code when the task is not conversation generation. */
const unsupportedTaskCode = "unsupported_task";

/** Stable code when the mode is not unary. */
const unsupportedModeCode = "unsupported_mode";

/** Stable code when the request has no absolute service endpoint. */
const missingServiceEndpointCode = "missing_service_endpoint";

/** Stable code when the request has no authorization description. */
const missingAuthorizationCode = "missing_authorization";

/** HTTP method for a chat-completions call. */
const chatCompletionsMethod = "POST";

/**
 * Operation path stored separately from the service base.
 *
 * Runtime joins this path to the endpoint. This plan does not concatenate them
 * and does not rewrite an endpoint that already contains an operation path.
 */
const chatCompletionsPath = "/chat/completions";

/** JSON media type the payload encoder and both decoders must accept. */
const jsonMediaType = Object.freeze({
  type: "application",
  subtype: "json",
  parameters: Object.freeze({}),
});

/** Shared empty header list. Frozen so one plan cannot add a header to another. */
const emptyHeaders: ProtocolExecutionPlan["transportPlan"]["headers"] = Object.freeze([]);

/** Shared empty query list. Frozen for the same reason as the headers. */
const emptyQuery: ProtocolExecutionPlan["transportPlan"]["query"] = Object.freeze([]);

/** Shared empty transport extensions. */
const emptyTransportExtensions: ProtocolExecutionPlan["transportPlan"]["transportExtensions"] =
  Object.freeze({});

/** Unary mode adds no streaming component requirements. */
const emptyModeComponents: ProtocolExecutionPlan["modeComponents"] = Object.freeze([]);

/** Shared empty plan extensions. */
const emptyPlanExtensions: ProtocolExecutionPlan["extensions"] = Object.freeze({});

/**
 * Input identity of an unencoded chat-completions request value.
 *
 * Request building uses the same identity so the payload and the plan describe
 * one port.
 */
export const OPENAI_CHAT_REQUEST_TYPE_ID = "protocol.openai.chat-request";

/** Output identity of a decoded chat-completions success value. */
const chatResponseTypeId = "protocol.openai.chat-response";

/**
 * Prepares the chat-completions execution requirements for one request.
 *
 * The result is a plan, not a call. The same request, mode, and policy always
 * produce the same requirements. Nothing is fetched, and authorization is
 * copied by reference so a credential source is not read. The endpoint stays
 * the service base and the operation path stays a separate field.
 *
 * A mismatch or a missing endpoint or authorization returns one error diagnostic
 * and no plan. Compatibility policy does not change the plan: there is no
 * lossy field to relax.
 *
 * @param input Request, mode, and compatibility policy supplied to the adapter.
 * @returns The frozen plan, or diagnostics and no value.
 */
export function prepareOpenAIChatCompletionPlan(input: {
  readonly request: ModelRequest;
  readonly mode: InteractionMode;
  readonly policy: CompatibilityPolicy;
}): ProcessingResult<ProtocolExecutionPlan> {
  // Policy is part of the adapter input. This plan has no lossy branch, so both
  // strict and compatible modes keep the same requirements when the input matches.
  if (input.policy?.mode === undefined) {
    return failure("invalid_compatibility_policy", "Compatibility policy must name a mode.");
  }
  if (!matchesOpenAIChatCompletionsProtocol(input.request?.target?.protocolId)) {
    return failure(
      unsupportedProtocolCode,
      "Protocol is not openai.chat.completions.",
      "target.protocolId",
    );
  }
  if (!matchesConversationGenerateTask(input.request.task?.descriptor?.type)) {
    return failure(
      unsupportedTaskCode,
      "Task type is not conversation.generate.",
      "task.descriptor.type",
    );
  }
  if (!matchesUnaryInteractionMode(input.mode)) {
    return failure(unsupportedModeCode, "Interaction mode is not unary.", "mode.id");
  }

  const endpoint = input.request.serviceAccess?.endpoint;
  // Only an absolute endpoint can be planned. A missing or relative value is not
  // replaced with a default host.
  if (endpoint?.kind !== "absolute" || !isHttpEndpoint(endpoint.value)) {
    return failure(
      missingServiceEndpointCode,
      "Service access must include an absolute http(s) endpoint.",
      "serviceAccess.endpoint",
    );
  }
  const authorization = input.request.serviceAccess?.authorization;
  // The description is planned as-is. Reading its credential source would make
  // planning depend on a secret that belongs to the later authorization stage.
  if (authorization === undefined) {
    return failure(
      missingAuthorizationCode,
      "Service access must include an authorization description.",
      "serviceAccess.authorization",
    );
  }

  return {
    diagnostics: [],
    value: Object.freeze({
      transportPlan: Object.freeze({
        endpoint,
        path: chatCompletionsPath,
        method: chatCompletionsMethod,
        headers: emptyHeaders,
        query: emptyQuery,
        authorization,
        transportExtensions: emptyTransportExtensions,
      }),
      // Separate objects so a later change to one decoder criterion cannot
      // change the encoder or the other decoder.
      payloadEncoder: Object.freeze({ mediaType: jsonMediaType }),
      successDecoder: Object.freeze({ mediaType: jsonMediaType }),
      errorDecoder: Object.freeze({ mediaType: jsonMediaType }),
      // No transport kind or capability is required: the built-in fetch
      // transport declares neither, and an extra requirement would make this
      // plan unselectable.
      transport: Object.freeze({ requiredCapabilities: new Set<string>() }),
      modeComponents: emptyModeComponents,
      typeContract: Object.freeze({
        inputTypeId: OPENAI_CHAT_REQUEST_TYPE_ID,
        outputTypeId: chatResponseTypeId,
      }),
      extensions: emptyPlanExtensions,
    }),
  };
}

/**
 * Returns whether a planned endpoint uses http or https.
 *
 * @param value Absolute endpoint text.
 * @returns Whether the scheme is `http:` or `https:`.
 */
function isHttpEndpoint(value: string): boolean {
  // Compare the scheme only. The rest of the URL stays unchanged.
  return value.startsWith("https://") || value.startsWith("http://");
}

/**
 * Returns a planning failure with one error and no usable plan.
 *
 * @param code Stable diagnostic code.
 * @param message Technical summary that does not include secrets or payload text.
 * @param path Field that failed, when one field is responsible.
 * @returns A processing result without a value.
 */
function failure(
  code: string,
  message: string,
  path?: string,
): ProcessingResult<ProtocolExecutionPlan> {
  return {
    diagnostics: [
      {
        code,
        severity: "error",
        phase: "planning",
        message,
        ...(path === undefined ? {} : { path }),
      },
    ],
  };
}
