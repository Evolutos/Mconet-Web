// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  type InteractionMode,
  type ModelOutput,
  type ModelRequest,
  type ResolvedInteractionResourceLimits,
} from "@evolutos/mconet-core-domain";
import {
  createInteractionContext,
  determineComponentOwnership,
  executeUnaryInteraction,
  type ModelClientConfigurationData,
} from "@evolutos/mconet-core-runtime";
import type {
  AuthorizationHandler,
  AuthorizationHandlerResolver,
  InteractionMonitor,
  InteractionOptions,
  ModelIntegrationResolver,
  PayloadDecoder,
  PayloadEncoder,
  RuntimeComponent,
  ServerStreamReader,
  ServiceAccessResolver,
  StreamingByteTransport,
  StreamingTransportResponse,
  TaskProtocolAdapter,
  Transport,
  TransportContext,
  TransportRequest,
} from "@evolutos/mconet-core-spi";

import type { ModelClient } from "./model-client.js";
import { createTextStreamQueue, type TextStreamInteraction } from "./text-stream-interaction.js";
import { redactRawResponse } from "./redact-raw-response.js";
import type { RawResponseSnapshot } from "./raw-response-snapshot.js";

/** Default text mode. One JSON response comes back. */
const unaryMode = { id: "unary" } as const;

/** Text mode that reads server-sent events. */
const serverStreamMode = { id: "server_stream" } as const;

/** Stable code when a new request arrives after the client has closed. */
const clientClosedCode = "client_closed";

/** Stable code when an opted-in raw response exceeds the response byte limit. */
const rawResponseTooLargeCode = "raw_response_too_large";

/**
 * Components and limits a client holds so each call can enter the one runtime.
 *
 * These values are reusable configuration. They are not the current request,
 * a secret, or a caller cancellation signal.
 */
export interface DefaultModelClientDependencies {
  /** Domain defaults merged by the runtime below a single call. */
  readonly clientConfiguration: ModelClientConfigurationData;

  /** Finite SDK limits used when a call does not override them. */
  readonly sdkResourceLimits: ResolvedInteractionResourceLimits;

  /** Optional direct adapter used when a call does not supply its own. */
  readonly adapter?: TaskProtocolAdapter;

  /** Optional integration resolver used when a call does not supply its own. */
  readonly resolver?: ModelIntegrationResolver;

  /** Optional service-access resolver used when a call does not supply its own. */
  readonly serviceAccessResolver?: ServiceAccessResolver;

  /** Optional handler resolver used when a call does not supply its own. */
  readonly authorizationHandlerResolver?: AuthorizationHandlerResolver;

  /** Handler candidates used when a call does not supply its own list. */
  readonly authorizationHandlers: readonly AuthorizationHandler[];

  /** Client-tier encoder. A call encoder is placed above it by the runtime. */
  readonly payloadEncoder?: PayloadEncoder;

  /** Client-tier success decoder. */
  readonly successPayloadDecoder?: PayloadDecoder;

  /** Client-tier error decoder. */
  readonly errorPayloadDecoder?: PayloadDecoder;

  /** Client-tier transport. */
  readonly transport?: Transport;

  /** Client-tier reader used when a call selects `server_stream` and does not inject one. */
  readonly serverStreamReader?: ServerStreamReader;

  /** Client default mode used when a call does not name one. Omission means unary. */
  readonly defaultInteractionMode?: InteractionMode;

  /** Monitors observed after the runtime assembles an output. */
  readonly monitors?: readonly InteractionMonitor[];

  /**
   * Instances the SDK constructed. Close releases only these identities.
   * An omitted set means this client owns no SDK resource.
   */
  readonly sdkCreatedComponents?: ReadonlySet<RuntimeComponent>;
}

/**
 * Client that performs every text interaction through one runtime.
 *
 * The class does not encode, authorize, or send on its own. Call options are
 * placed into the runtime input; component priority stays inside the runtime.
 * Close moves the client to the closed state, can be repeated, and releases
 * only the SDK-created component identities recorded for this client.
 */
export class DefaultModelClient implements ModelClient {
  /** Reusable inputs. A call does not write back into this object. */
  readonly #dependencies: DefaultModelClientDependencies;

  /**
   * Whether this client still accepts a new request.
   *
   * Construction leaves the client open. The flag is not a current request,
   * secret, or cancellation signal.
   */
  #acceptingRequests = true;

  /**
   * Stores reusable inputs by reference.
   *
   * @param dependencies Configuration, limits, and components for later calls.
   */
  public constructor(dependencies: DefaultModelClientDependencies) {
    this.#dependencies = dependencies;
  }

  /**
   * Runs one request through the unary runtime.
   *
   * A fresh context is created for the call. The client does not retain the
   * request, the options, or the signal. A component supplied on the call is
   * the interaction tier; the stored component is the client tier.
   *
   * @param request Task-neutral request envelope.
   * @param options Optional per-call overrides.
   * @returns The output assembled by the runtime.
   */
  public async interact(
    request: ModelRequest,
    options?: InteractionOptions,
  ): Promise<ModelOutput & { readonly rawResponse?: RawResponseSnapshot }> {
    return this.#execute(request, options);
  }

  /**
   * Runs one text request as `server_stream`.
   *
   * The request body asks the service for events. `events` yields each new
   * text fragment. `output` is the same assembled result `interact` returns
   * for a unary call. A call mode other than the default is replaced by
   * `server_stream` for this method.
   *
   * @param request Task-neutral request envelope.
   * @param options Optional per-call overrides. `mode` is set to `server_stream`.
   * @returns The fragment stream and the final output.
   */
  public stream(request: ModelRequest, options?: InteractionOptions): TextStreamInteraction {
    const queue = createTextStreamQueue();
    const output = this.#execute(
      request,
      { ...options, mode: serverStreamMode },
      (text) => {
        queue.push(text);
      },
    ).then(
      (value) => {
        queue.close();
        return value;
      },
      (error: unknown) => {
        queue.fail(error);
        throw error;
      },
    );
    return { events: queue.events, output };
  }

  /**
   * Runs one request in the resolved text mode.
   *
   * @param request Task-neutral request envelope.
   * @param options Optional per-call overrides.
   * @param onServerStreamText Observer used only when the resolved mode is server stream.
   * @returns The output assembled by the runtime.
   */
  async #execute(
    request: ModelRequest,
    options?: InteractionOptions,
    onServerStreamText?: (text: string) => void,
  ): Promise<ModelOutput & { readonly rawResponse?: RawResponseSnapshot }> {
    if (!this.#acceptingRequests) {
      throw createClientClosedError();
    }
    const dependencies = this.#dependencies;
    const mode = options?.mode ?? dependencies.defaultInteractionMode ?? unaryMode;
    const callComponents = options?.components;
    const serverStreamReader =
      callComponents?.serverStreamReader ?? dependencies.serverStreamReader;
    const includeRawResponse = options?.includeRawResponse === true;
    const captured: { snapshot?: RawResponseSnapshot; tooLarge: boolean } = { tooLarge: false };
    const transportForCall = (component: Transport | undefined) =>
      component === undefined || !includeRawResponse
        ? component
        : captureResponse(component, captured, rawResponseByteLimit(options, dependencies));
    const output = await executeUnaryInteraction({
      context: createInteractionContext({
        request,
        ...(options === undefined ? {} : { options: interactionData(options) }),
      }),
      mode,
      ...(mode.id !== serverStreamMode.id
        ? {}
        : {
            ...(serverStreamReader === undefined ? {} : { serverStreamReader }),
            ...(onServerStreamText === undefined ? {} : { onServerStreamText }),
          }),
      clientConfiguration: dependencies.clientConfiguration,
      sdkResourceLimits: dependencies.sdkResourceLimits,
      ...optionalInput("adapter", callComponents?.taskProtocolAdapter ?? dependencies.adapter),
      ...optionalInput(
        "resolver",
        callComponents?.modelIntegrationResolver ?? dependencies.resolver,
      ),
      ...optionalInput(
        "serviceAccessResolver",
        callComponents?.serviceAccessResolver ?? dependencies.serviceAccessResolver,
      ),
      ...optionalInput(
        "authorizationHandlerResolver",
        callComponents?.authorizationHandlerResolver ?? dependencies.authorizationHandlerResolver,
      ),
      authorizationHandlers:
        callComponents?.authorizationHandlers ?? dependencies.authorizationHandlers,
      payloadEncoder: tier(callComponents?.payloadEncoder, dependencies.payloadEncoder),
      successPayloadDecoder: tier(
        callComponents?.successPayloadDecoder,
        dependencies.successPayloadDecoder,
      ),
      errorPayloadDecoder: tier(
        callComponents?.errorPayloadDecoder,
        dependencies.errorPayloadDecoder,
      ),
      transport: tier(
        transportForCall(callComponents?.transport),
        transportForCall(dependencies.transport),
      ),
      ...(dependencies.monitors === undefined ? {} : { monitors: dependencies.monitors }),
      interactionId: crypto.randomUUID(),
    });
    if (captured.tooLarge) {
      throw createRawResponseTooLargeError();
    }
    if (!includeRawResponse || captured.snapshot === undefined) {
      return output;
    }
    return { ...output, rawResponse: captured.snapshot };
  }

  /**
   * Stops new requests and releases SDK-created resources once.
   *
   * A second call leaves the client closed and does not release again.
   * A component that is not in the SDK-created set is left open, including
   * when it has a close method.
   *
   * @returns A promise that settles after the first release attempt.
   */
  public async close(): Promise<void> {
    if (!this.#acceptingRequests) {
      return;
    }
    this.#acceptingRequests = false;
    const created = this.#dependencies.sdkCreatedComponents;
    if (created === undefined) {
      return;
    }
    for (const component of created) {
      if (determineComponentOwnership({ component, sdkCreatedComponents: created }) !== "builtin") {
        continue;
      }
      await closeSdkComponent(component);
    }
  }
}

/**
 * Copies the data fields the runtime context accepts.
 *
 * Component and monitoring fields stay out of this bag. They are applied as
 * runtime inputs instead of being stored on the request context.
 *
 * @param options Call options supplied by the caller.
 * @returns Data overrides for one context.
 */
/**
 * Creates the stable rejection for a request that arrives after close.
 *
 * @returns An error that does not include request or component data.
 */
/**
 * Releases one SDK-created component when it exposes close.
 *
 * Descriptor source is not consulted. A component without close stays as it is.
 *
 * @param component Instance recorded as SDK-created.
 */
async function closeSdkComponent(component: RuntimeComponent): Promise<void> {
  if (!("close" in component) || typeof component.close !== "function") {
    return;
  }
  await component.close();
}

/**
 * Copies one successful transport response when the call opted in.
 *
 * The descriptor stays the selected transport's descriptor. The body is copied
 * so a later decoder does not share the snapshot's storage. Metadata is kept
 * by reference until redaction owns that copy.
 *
 * @param transport Transport that will actually send.
 * @param captured Slot filled with the snapshot for this call only.
 * @returns A transport that sends once and records the response.
 */
function captureResponse(
  transport: Transport,
  captured: { snapshot?: RawResponseSnapshot; tooLarge: boolean },
  maxResponseBodyBytes: number,
): Transport {
  const wrapped: Transport & Partial<StreamingByteTransport> = {
    descriptor: transport.descriptor,
    send: async (request, context) => {
      const response = await transport.send(request, context);
      if (response.body.byteLength > maxResponseBodyBytes) {
        // Keep the oversized body out of the snapshot. The caller receives a
        // stable error after the runtime returns, not a truncated copy.
        captured.tooLarge = true;
        return response;
      }
      const bytes = new Uint8Array(response.body.byteLength);
      bytes.set(response.body);
      captured.snapshot = redactRawResponse({ bytes, metadata: response.metadata });
      return response;
    },
  };
  if (isStreamingByteTransport(transport)) {
    wrapped.open = (request, context) =>
      captureOpen(transport, request, context, captured, maxResponseBodyBytes);
  }
  return wrapped;
}

/**
 * Forwards a framed response and keeps a bounded raw copy.
 *
 * @param transport Transport that exposes frames.
 * @param request Authorized request.
 * @param context Transport controls.
 * @param captured Slot filled when the body fits.
 * @param maxResponseBodyBytes Maximum snapshot length.
 * @returns The opened response, with the same frames the caller will read.
 */
async function captureOpen(
  transport: Transport & StreamingByteTransport,
  request: TransportRequest,
  context: TransportContext,
  captured: { snapshot?: RawResponseSnapshot; tooLarge: boolean },
  maxResponseBodyBytes: number,
): Promise<StreamingTransportResponse> {
  const opened = await transport.open(request, context);
  const chunks: Uint8Array[] = [];
  let total = 0;
  return {
    metadata: opened.metadata,
    body: {
      async *[Symbol.asyncIterator]() {
        try {
          for await (const chunk of opened.body) {
            if (!captured.tooLarge) {
              if (chunk.byteLength > maxResponseBodyBytes - total) {
                captured.tooLarge = true;
                chunks.length = 0;
              } else {
                chunks.push(chunk);
                total += chunk.byteLength;
              }
            }
            yield chunk;
          }
        } finally {
          if (!captured.tooLarge) {
            const bytes = new Uint8Array(total);
            let offset = 0;
            for (const chunk of chunks) {
              bytes.set(chunk, offset);
              offset += chunk.byteLength;
            }
            captured.snapshot = redactRawResponse({ bytes, metadata: opened.metadata });
          }
        }
      },
    },
  };
}

/**
 * Returns whether a transport can open a framed body.
 *
 * @param transport Transport selected for this call.
 * @returns Whether `open` is a function.
 */
function isStreamingByteTransport(
  transport: Transport,
): transport is Transport & StreamingByteTransport {
  return "open" in transport && typeof transport.open === "function";
}

/**
 * Selects the response byte limit that applies to an opted-in snapshot.
 *
 * A call field wins, then the client default, then the SDK limit. This matches
 * resource-limit precedence for the one field the snapshot guard reads.
 *
 * @param options Call options, when the caller supplied them.
 * @param dependencies Stored client defaults and SDK limits.
 * @returns The maximum snapshot length in bytes.
 */
function rawResponseByteLimit(
  options: InteractionOptions | undefined,
  dependencies: DefaultModelClientDependencies,
): number {
  const interactionLimit = options?.resourceLimits?.maxResponseBodyBytes;
  if (interactionLimit !== undefined) {
    return interactionLimit;
  }
  const clientLimit = dependencies.clientConfiguration.defaultResourceLimits?.maxResponseBodyBytes;
  if (clientLimit !== undefined) {
    return clientLimit;
  }
  return dependencies.sdkResourceLimits.maxResponseBodyBytes;
}

/**
 * Creates the stable failure for an oversized raw snapshot.
 *
 * The error does not include the response body or header values.
 *
 * @returns The size-limit error.
 */
function createRawResponseTooLargeError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "The raw response exceeds the response byte limit.",
    category: "invalid_request",
    phase: "decoding",
    code: rawResponseTooLargeCode,
    diagnostics: [],
  });
}

function createClientClosedError(): ModelInteractionError {
  return new ModelInteractionError({
    message: "The client is closed and cannot accept a new request.",
    category: "invalid_request",
    phase: "validation",
    code: clientClosedCode,
    diagnostics: [],
  });
}

function interactionData(options: InteractionOptions) {
  return {
    ...(options.serviceAccessOverride === undefined
      ? {}
      : { serviceAccessOverride: options.serviceAccessOverride }),
    ...(options.compatibilityPolicy === undefined
      ? {}
      : { compatibilityPolicy: options.compatibilityPolicy }),
    ...(options.resourceLimits === undefined ? {} : { resourceLimits: options.resourceLimits }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(options.deadline === undefined ? {} : { deadline: options.deadline }),
    ...(options.includeRawResponse === undefined
      ? {}
      : { includeRawResponse: options.includeRawResponse }),
  };
}

/**
 * Places a call component above a stored client component.
 *
 * An omitted tier is left out of the object. Integration and SDK tiers are
 * empty until a factory supplies them. The runtime decides which tier runs.
 *
 * @param interaction Component supplied for this call only.
 * @param client Component stored on the client.
 * @returns Candidates for one runtime role.
 */
function tier<Component>(interaction: Component | undefined, client: Component | undefined) {
  return {
    ...(interaction === undefined ? {} : { interactionComponent: interaction }),
    ...(client === undefined ? {} : { clientComponent: client }),
    integrationComponents: [],
  };
}

/**
 * Adds one optional runtime input without passing an explicit undefined.
 *
 * @param key Runtime input name.
 * @param value Value to include when it exists.
 * @returns A one-property object, or an empty object when the value is absent.
 */
function optionalInput<Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): { readonly [K in Key]?: Value } {
  if (value === undefined) {
    return {};
  }
  return { [key]: value } as { readonly [K in Key]: Value };
}
