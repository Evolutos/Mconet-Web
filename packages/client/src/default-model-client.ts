// Copyright © 2026 Mcont.

import type {
  ModelOutput,
  ModelRequest,
  ResolvedInteractionResourceLimits,
} from "@evolutos/mconet-core-domain";
import {
  createInteractionContext,
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
  ServiceAccessResolver,
  TaskProtocolAdapter,
  Transport,
} from "@evolutos/mconet-core-spi";

import type { ModelClient } from "./model-client.js";

/** R1 executes one request and returns one output. There is no second mode here. */
const unaryMode = { id: "unary" } as const;

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
}

/**
 * Client that performs every interaction by calling the unary runtime once.
 *
 * The class does not encode, authorize, or send on its own. Call options are
 * placed into the runtime input; component priority stays inside the runtime.
 * Close is present so the class satisfies the client contract. Resource release
 * and the closed state are later lifecycle steps, so this close does not dispose
 * anything.
 */
export class DefaultModelClient implements ModelClient {
  /** Reusable inputs. A call does not write back into this object. */
  readonly #dependencies: DefaultModelClientDependencies;

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
  public async interact(request: ModelRequest, options?: InteractionOptions): Promise<ModelOutput> {
    const dependencies = this.#dependencies;
    const callComponents = options?.components;
    return executeUnaryInteraction({
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
      transport: tier(callComponents?.transport, dependencies.transport),
      ...(dependencies.monitors === undefined ? {} : { monitors: dependencies.monitors }),
      interactionId: crypto.randomUUID(),
    });
  }

  /**
   * Satisfies the client contract without releasing resources.
   *
   * Open, idempotent close, and SDK-owned release are separate lifecycle steps.
   *
   * @returns A settled promise.
   */
  public async close(): Promise<void> {
    return undefined;
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
