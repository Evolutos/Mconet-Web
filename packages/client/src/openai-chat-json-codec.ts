// Copyright © 2026 Mcont.

import {
  JsonPayloadEncoder,
  JsonSuccessPayloadDecoder,
  jsonPayloadEncoderCapabilityId,
} from "@evolutos/mconet-codec-json";
import type { MediaType, OpenIdentifier } from "@evolutos/mconet-core-domain";
import type {
  ComponentDescriptor,
  PayloadDecoder,
  PayloadEncoder,
} from "@evolutos/mconet-core-spi";
import {
  OPENAI_CHAT_REQUEST_TYPE_ID,
  OPENAI_CHAT_RESPONSE_TYPE_ID,
} from "@evolutos/mconet-integration-openai-compatible";

/** JSON media type the chat-completions plan requires on both decoders. */
const jsonMediaType: MediaType = {
  type: "application",
  subtype: "json",
  parameters: {},
};

/** Capability shared with the generic JSON encoder. It does not select this wrapper. */
const encoderCapabilities: ReadonlySet<OpenIdentifier> = new Set([jsonPayloadEncoderCapabilityId]);

/** Success decoding is chosen by outcome, so this wrapper publishes no capability. */
const decoderCapabilities: ReadonlySet<OpenIdentifier> = new Set();

/**
 * Encoder port for an unencoded chat-completions request.
 *
 * The plan names `protocol.openai.chat-request` and does not declare media.
 * An input media list here would fail that connection. The bytes are still
 * JSON because encoding delegates to the generic JSON encoder.
 */
const encoderDescriptor: ComponentDescriptor = Object.freeze({
  name: "openai-chat-json-encoder",
  version: "1.0.0",
  capabilities: encoderCapabilities,
  source: "builtin",
  typeContract: Object.freeze({
    inputTypeId: OPENAI_CHAT_REQUEST_TYPE_ID,
    outputTypeId: "codec.bytes",
  }),
});

/**
 * Success-decoder port for a chat-completions response.
 *
 * The plan requires `protocol.openai.chat-response` and `application/json`.
 * The generic JSON decoder reports `json.value`, which success parsing rejects,
 * so this wrapper keeps the parsed value and publishes the protocol port.
 */
const successDecoderDescriptor: ComponentDescriptor = Object.freeze({
  name: "openai-chat-json-success-decoder",
  version: "1.0.0",
  capabilities: decoderCapabilities,
  source: "builtin",
  typeContract: Object.freeze({
    inputTypeId: "codec.bytes",
    outputTypeId: OPENAI_CHAT_RESPONSE_TYPE_ID,
    inputMediaTypes: Object.freeze([jsonMediaType]),
    outputMediaTypes: Object.freeze([jsonMediaType]),
  }),
});

/**
 * Encodes one chat-completions request as JSON bytes.
 *
 * The generic encoder serializes the payload value and ignores its type id.
 * This wrapper only changes the port the runtime connects to the plan.
 *
 * @returns A stateless encoder for the chat-completions request port.
 */
export function createOpenAIChatJsonEncoder(): PayloadEncoder {
  const encoder = new JsonPayloadEncoder();
  return {
    descriptor: encoderDescriptor,
    encode(value, context) {
      return encoder.encode(value, context);
    },
  };
}

/**
 * Decodes one JSON success body as a chat-completions response value.
 *
 * @param maxBodyBytes Maximum UTF-8 body length accepted before parsing.
 * @returns A decoder whose output type is the chat-completions success port.
 */
export function createOpenAIChatJsonSuccessDecoder(maxBodyBytes: number): PayloadDecoder {
  const decoder = new JsonSuccessPayloadDecoder(maxBodyBytes);
  return {
    descriptor: successDecoderDescriptor,
    async decode(bytes, context) {
      const decoded = await decoder.decode(bytes, context);
      return { typeId: OPENAI_CHAT_RESPONSE_TYPE_ID, value: decoded.value };
    },
  };
}
