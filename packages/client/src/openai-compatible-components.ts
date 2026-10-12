// Copyright © 2026 Mcont.

import type { RuntimeComponents } from "@evolutos/mconet-core-spi";

import { sdkResourceLimits } from "./create-default-client.js";
import {
  createOpenAIChatJsonEncoder,
  createOpenAIChatJsonSuccessDecoder,
} from "./openai-chat-json-codec.js";

/**
 * Codec overrides that connect the chat-completions plan to JSON bytes.
 *
 * The generic client codecs use `json.value`. The chat plan and success parser
 * use protocol ports, so both platform factories install these overrides and
 * leave the error decoder on the generic JSON decoder. Error parsing already
 * accepts that decoder's `json.value` output.
 *
 * @returns Encoder and success decoder for one OpenAI-compatible client.
 */
export function createOpenAICompatibleComponents(): Pick<
  RuntimeComponents,
  "payloadEncoder" | "successPayloadDecoder"
> {
  return {
    payloadEncoder: createOpenAIChatJsonEncoder(),
    successPayloadDecoder: createOpenAIChatJsonSuccessDecoder(
      sdkResourceLimits.maxResponseBodyBytes,
    ),
  };
}
