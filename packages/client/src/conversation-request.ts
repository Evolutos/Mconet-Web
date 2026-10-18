// Copyright © 2026 Mcont.

import {
  ConversationTaskBuilder,
  ModelRequestBuilder,
  parseMediaType,
  type Artifact,
  type InlineArtifactSource,
  type JsonValue,
  type UriArtifactSource,
  type MessageContent,
  type TaskDocument,
  type ModelRequest,
  type ModelTarget,
  type ServiceAccess,
  type ToolCall,
} from "@evolutos/mconet-core-domain";

/** Roles a text convenience message can name. Each maps to one standard role id. */
const messageRoleIds = {
  system: "message.system",
  user: "message.user",
  assistant: "message.assistant",
  tool: "message.tool",
} as const;

/**
 * One function the model may call.
 *
 * `parameters` is a JSON Schema object. This declaration has no implementation.
 */
export interface ConversationTool {
  /** Function name the model uses when it asks for this tool. */
  readonly name: string;

  /** Optional guidance shown to the model. */
  readonly description?: string;

  /** JSON Schema object describing the function arguments. */
  readonly parameters: JsonValue;
}

/**
 * One image attached to a conversation turn.
 *
 * Set `bytes` or `uri`, not both. Inline bytes require an image media type.
 * A URI must be an absolute http(s) URL or a base64 `data:image` URI.
 */
export interface ConversationImage {
  /** Image media type, such as `image/png`. Required when `bytes` is set. */
  readonly mediaType?: string;

  /** Inline image bytes. The helper does not copy them until the task is built. */
  readonly bytes?: Uint8Array;

  /** Absolute http(s) URL or base64 data URI. */
  readonly uri?: string;
}

/** One text turn in a convenience conversation request. */
export interface ConversationMessage {
  /** Speaker of this turn. */
  readonly role: keyof typeof messageRoleIds;

  /** Text content of this turn. The helper does not interpret the characters. */
  readonly text: string;

  /**
   * Images referenced by this turn, in order, after the text.
   *
   * Each image becomes an `artifact.image` and a `content.artifact` value.
   */
  readonly images?: readonly ConversationImage[];

  /** Call identity required when `role` is `tool`. */
  readonly toolCallId?: string;

  /** Function calls required when an assistant turn is asking for tools. */
  readonly toolCalls?: readonly ToolCall[];
}

/**
 * Inputs for one text conversation request.
 *
 * The target is required because a model request envelope always names one.
 * This helper does not read a client default, call a runtime, or send HTTP.
 */
export interface ConversationRequestInput {
  /** Service, protocol, and model selected for the request. */
  readonly target: ModelTarget;

  /** Ordered text turns. Order is the message-document order. */
  readonly messages: readonly ConversationMessage[];

  /**
   * Function tools declared for this request.
   *
   * Omission and an empty list both leave the tool member off the task. The
   * helper does not execute these declarations.
   */
  readonly tools?: readonly ConversationTool[];

  /** Optional unresolved access contribution copied onto the request. */
  readonly serviceAccess?: ServiceAccess;
}

/**
 * Builds one model request from text turns.
 *
 * The result is only the domain envelope. Task validation stays in the
 * conversation task builder, and envelope validation stays in the model request
 * builder. No interaction is started.
 *
 * @param input Target, text turns, and optional access.
 * @returns A validated model request.
 * @throws {TypeError} When the turns are not a supported conversation task.
 */
export function conversationRequest(input: ConversationRequestInput): ModelRequest {
  // The task builder validates turns, tool declarations, and message facts.
  // This function does not call a model.
  const built = createDocument(input.messages, input.tools);
  const taskBuilder = new ConversationTaskBuilder(built.document);
  if (built.artifacts.length > 0) {
    taskBuilder.withArtifacts({ artifacts: built.artifacts });
  }
  const task = taskBuilder.build();
  const builder = new ModelRequestBuilder(input.target, task);
  if (input.serviceAccess !== undefined) {
    builder.withServiceAccess(input.serviceAccess);
  }
  return builder.build();
}

/**
 * Places each text turn in one conversation input leaf.
 *
 * Identifiers come from turn order so the same input builds the same tree.
 * The helper does not add generation parameters or a second task node.
 *
 * @param messages Ordered text turns.
 * @param tools Function declarations, omitted from the task when absent or empty.
 * @returns A task document and the image artifacts those turns reference.
 */
function createDocument(
  messages: readonly ConversationMessage[],
  tools: readonly ConversationTool[] | undefined,
): { readonly document: TaskDocument; readonly artifacts: readonly Artifact[] } {
  const artifacts: Artifact[] = [];
  return {
    artifacts,
    document: {
      version: "1.0",
      root: {
        id: "task-root",
        kind: "task.root" as const,
        composition: "container" as const,
        children: [
          {
            id: "conversation-input",
            kind: "task.input.conversation" as const,
            composition: "leaf" as const,
            // An empty list is omitted so the task matches a conversation that
            // declared no functions.
            ...(tools === undefined || tools.length === 0 ? {} : { tools }),
            messages: {
              version: "1.0",
              purpose: "input" as const,
              root: {
                id: "message-root",
                kind: "message.root" as const,
                composition: "container" as const,
                children: messages.map((message, index) => ({
                  id: `message-${index}`,
                  kind: "message.entry" as const,
                  role: { id: messageRoleIds[message.role], extensions: {} },
                  content: contentForMessage(message, index, artifacts),
                  relations: [],
                  metadata: {},
                  extensions: {},
                  // Tool facts stay off the entry when the caller omitted them.
                  ...(message.toolCallId === undefined ? {} : { toolCallId: message.toolCallId }),
                  ...(message.toolCalls === undefined ? {} : { toolCalls: message.toolCalls }),
                })),
                relations: [],
                metadata: {},
                extensions: {},
              },
              metadata: {},
              extensions: {},
            },
            relations: [],
            metadata: {},
            extensions: {},
          },
        ],
        relations: [],
        metadata: {},
        extensions: {},
      },
      metadata: {},
      extensions: {},
    },
  };
}

/**
 * Builds the text content and one artifact reference per image.
 *
 * @param message Turn being placed in the document.
 * @param index Turn index. It supplies content and artifact ids.
 * @param artifacts Catalog under construction. Images are appended.
 * @returns Ordered content for the entry.
 */
function contentForMessage(
  message: ConversationMessage,
  index: number,
  artifacts: Artifact[],
): MessageContent[] {
  // The convenience helper places every image after the one text segment.
  // A caller that needs another order builds the domain document directly.
  const content: MessageContent[] = [
    {
      id: `content-${index}`,
      kind: "content.text",
      text: message.text,
      metadata: {},
      extensions: {},
    },
  ];
  for (const [imageIndex, image] of (message.images ?? []).entries()) {
    const artifactId = `image-${index}-${imageIndex}`;
    artifacts.push(artifactFromImage(artifactId, image));
    content.push({
      id: `content-${index}-image-${imageIndex}`,
      kind: "content.artifact",
      artifactId,
      metadata: {},
      extensions: {},
    });
  }
  return content;
}

/**
 * Builds one image artifact from a convenience image.
 *
 * @param id Catalog-local identity.
 * @param image Caller-supplied bytes or URI.
 * @returns The artifact.
 * @throws {TypeError} When the image does not set exactly one supported source.
 */
function artifactFromImage(id: string, image: ConversationImage): Artifact {
  const hasBytes = image.bytes !== undefined;
  const hasUri = image.uri !== undefined;
  // Exactly one source. Both and neither are the same mistake: the helper
  // would otherwise have to choose which source the catalog stores.
  if (hasBytes === hasUri) {
    throw new TypeError("A conversation image must set exactly one of bytes or uri.");
  }
  if (image.bytes !== undefined) {
    const mediaType = image.mediaType;
    if (mediaType === undefined || parseMediaType(mediaType)?.type !== "image") {
      throw new TypeError("An inline conversation image must name an image media type.");
    }
    const source: InlineArtifactSource = { kind: "artifact.source.inline", bytes: image.bytes };
    return {
      id,
      kind: { id: "artifact.image", extensions: {} },
      mediaType,
      source,
      metadata: {},
      extensions: {},
    };
  }
  // A URI may omit media type because a later read can discover it. Inline
  // bytes cannot: nothing after this helper inspects them to invent a type.
  const uri = image.uri ?? "";
  if (image.mediaType !== undefined && parseMediaType(image.mediaType)?.type !== "image") {
    throw new TypeError("A conversation image media type must be an image type.");
  }
  if (!isSupportedImageUri(uri)) {
    throw new TypeError(
      "A conversation image URI must be an absolute http(s) URL or a base64 data:image URI.",
    );
  }
  const source: UriArtifactSource = {
    kind: "artifact.source.uri",
    uri: { kind: "absolute", value: uri },
  };
  return {
    id,
    kind: { id: "artifact.image", extensions: {} },
    ...(image.mediaType === undefined ? {} : { mediaType: image.mediaType }),
    source,
    metadata: {},
    extensions: {},
  };
}

/**
 * Accepts absolute http(s) URLs without userinfo, and base64 image data URIs.
 *
 * @param value URI supplied by the caller.
 * @returns Whether the chat path can read this URI.
 */
function isSupportedImageUri(value: string): boolean {
  // A data URI is not parsed as a URL. `data:` has no host, and URL would
  // reject or misread the payload.
  if (value.startsWith("data:image/") && value.includes(";base64,")) {
    return true;
  }
  try {
    // Userinfo is rejected rather than stripped. A relative string does not
    // parse as an absolute URL and fails closed.
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
}
