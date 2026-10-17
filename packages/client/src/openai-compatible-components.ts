// Copyright © 2026 Mcont.

import {
  ApiKeyHeaderAuthorizationHandler,
  BearerAuthorizationHandler,
  NoAuthorizationHandler,
} from "@evolutos/mconet-auth-basic";
import type { RuntimeComponents } from "@evolutos/mconet-core-spi";
import { createOpenAIChatServerStreamReader } from "@evolutos/mconet-integration-openai-compatible";

import { sdkResourceLimits } from "./create-default-client.js";
import {
  createOpenAIChatJsonEncoder,
  createOpenAIChatJsonSuccessDecoder,
} from "./openai-chat-json-codec.js";

/**
 * Components that connect one chat-completions client.
 *
 * The generic client codecs use `json.value`. The chat plan and success parser
 * use protocol ports, so both platform factories install these overrides and
 * leave the error decoder on the generic JSON decoder. Error parsing already
 * accepts that decoder's `json.value` output. The three authorization handlers
 * match the R1 schemes by kind, so one service-access description selects
 * exactly one of them.
 *
 * @returns Codecs and authorization handlers for one OpenAI-compatible client.
 */
export function createOpenAICompatibleComponents(): Pick<
  RuntimeComponents,
  "payloadEncoder" | "successPayloadDecoder" | "authorizationHandlers" | "serverStreamReader"
> {
  return {
    payloadEncoder: createOpenAIChatJsonEncoder(),
    successPayloadDecoder: createOpenAIChatJsonSuccessDecoder(
      sdkResourceLimits.maxResponseBodyBytes,
    ),
    serverStreamReader: createOpenAIChatServerStreamReader(),
    authorizationHandlers: [
      new NoAuthorizationHandler(),
      new ApiKeyHeaderAuthorizationHandler(),
      new BearerAuthorizationHandler(),
    ],
  };
}
