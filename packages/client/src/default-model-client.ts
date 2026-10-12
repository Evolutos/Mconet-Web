// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
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
  ServiceAccessResolver,
  TaskProtocolAdapter,
  Transport,
} from "@evolutos/mconet-core-spi";

import type { ModelClient } from "./model-client.js";
import { redactRawResponse } from "./redact-raw-response.js";
import type { RawResponseSnapshot } from "./raw-response-snapshot.js";

/** R1 executes one request and returns one output. There is no second mode here. */
const unaryMode = { id: "unary" } as const;

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

  /** Monitors observed after the runtime assembles an output. */
  readonly monitors?: readonly InteractionMonitor[];

  /**
   * Instances the SDK constructed. Close releases only these identities.
   * An omitted set means this client owns no SDK resource.
   */
  readonly sdkCreatedComponents?: ReadonlySet<RuntimeComponent>;
}

/**
 * Client that performs every interaction by calling the unary runtime once.
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
    if (!this.#acceptingRequests) {
      throw createClientClosedError();
    }
    const dependencies = this.#dependencies;
    const callComponents = options?.components;
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
      mode: unaryMode,
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
  return {
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
