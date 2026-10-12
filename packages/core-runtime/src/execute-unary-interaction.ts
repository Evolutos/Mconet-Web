// Copyright © 2026 Mcont.

import {
  ModelInteractionError,
  type Authorization,
  type Diagnostic,
  type InteractionMode,
  type ModelOutput,
  type ProcessingResult,
  type ResolvedInteractionResourceLimits,
  type ServiceAccess,
} from "@evolutos/mconet-core-domain";
import type {
  AuthorizationHandler,
  AuthorizationHandlerResolver,
  ComponentSelectionResolution,
  CredentialSource,
  InteractionMonitor,
  ModelIntegrationResolver,
  PayloadDecoder,
  PayloadEncoder,
  ProtocolExecutionPlan,
  RuntimeComponent,
  ServiceAccessResolver,
  TaskProtocolAdapter,
  Transport,
  TransportRequest,
} from "@evolutos/mconet-core-spi";

import { captureUnknownInteractionFailure } from "./capture-unknown-interaction-failure.js";
import { createInteractionTermination } from "./create-interaction-termination.js";
import { freezeExecutionSnapshot } from "./freeze-execution-snapshot.js";
import type { InteractionContext } from "./interaction-context.js";
import { joinIntegrationBranches } from "./join-integration-branches.js";
import type { ModelClientConfigurationData } from "./model-client-configuration-data.js";
import { normalizeInteractionRequest } from "./normalize-interaction-request.js";
import { publishIsolatedMonitoringChain } from "./publish-isolated-monitoring-chain.js";
import { releaseInteractionContext } from "./release-interaction-context.js";
import { releaseInteractionResponse } from "./release-interaction-response.js";
import { resolveInteractionConfiguration } from "./resolve-interaction-configuration.js";
import { resolveInteractionDeadline } from "./resolve-interaction-deadline.js";
import { resolveInteractionSignal } from "./resolve-interaction-signal.js";
import { scheduleApplyAuthorization } from "./schedule-apply-authorization.js";
import { scheduleAuthorizationHandlerResolution } from "./schedule-authorization-handler-resolution.js";
import { scheduleBuildRequest } from "./schedule-build-request.js";
import { scheduleCapabilityValidation } from "./schedule-capability-validation.js";
import { scheduleComponentSelection } from "./schedule-component-selection.js";
import { scheduleCredentialRead } from "./schedule-credential-read.js";
import { scheduleDecodePayload } from "./schedule-decode-payload.js";
import { scheduleEncodePayload } from "./schedule-encode-payload.js";
import { scheduleModelOutputAssembly } from "./schedule-model-output-assembly.js";
import { scheduleParseResponse } from "./schedule-parse-response.js";
import { schedulePreAuthorizationEvent } from "./schedule-pre-authorization-event.js";
import { schedulePreAuthorizationSnapshot } from "./schedule-pre-authorization-snapshot.js";
import { schedulePreparePlan } from "./schedule-prepare-plan.js";
import { scheduleServiceAccessResolution } from "./schedule-service-access-resolution.js";
import { scheduleSuccessDecoderBranch } from "./schedule-success-decoder-branch.js";
import { scheduleTransportSend } from "./schedule-transport-send.js";
import { scheduleTypeContractValidation } from "./schedule-type-contract-validation.js";
import { validateR1Interaction } from "./validate-r1-interaction.js";
import { validateR1PlanScope } from "./validate-r1-plan-scope.js";
import { validateResponseContentType } from "./validate-response-content-type.js";

/** Role id assigned to the request encoder by component selection. */
const payloadEncoderRoleId = "codec.request.encoder";

/** Role id assigned to the success decoder by component selection. */
const successDecoderRoleId = "codec.response.success-decoder";

/** Role id assigned to the error decoder by component selection. */
const errorDecoderRoleId = "codec.response.error-decoder";

/** Role id assigned to the transport by component selection. */
const transportRoleId = "transport.request";

/** Candidates for one single-value component role. */
interface ComponentCandidates<Component extends RuntimeComponent> {
  readonly interactionComponent?: Component;
  readonly clientComponent?: Component;
  readonly integrationComponents: readonly Component[];
  readonly sdkDefaultComponent?: Component;
}

/**
 * Runs one unary interaction through the single runtime pipeline.
 *
 * Stages run in fixed order: normalize, validate, configure, integrate, plan,
 * select, encode, authorize, send, decode, parse, assemble, then release.
 * A stage that returns no value stops the pipeline before later stages. Monitor
 * failures do not replace the assembled output.
 *
 * @param input Request context, client defaults, and the components for this call.
 * @returns The assembled model output.
 * @throws {ModelInteractionError} When a stage fails or the interaction is cancelled.
 */
export async function executeUnaryInteraction(input: {
  readonly context: InteractionContext;
  readonly mode: InteractionMode;
  readonly clientConfiguration: ModelClientConfigurationData;
  readonly integrationServiceAccess?: ServiceAccess;
  readonly sdkResourceLimits: ResolvedInteractionResourceLimits;
  readonly adapter?: TaskProtocolAdapter;
  readonly resolver?: ModelIntegrationResolver;
  readonly serviceAccessResolver?: ServiceAccessResolver;
  readonly authorizationHandlerResolver?: AuthorizationHandlerResolver;
  readonly authorizationHandlers: readonly AuthorizationHandler[];
  readonly payloadEncoder: ComponentCandidates<PayloadEncoder>;
  readonly successPayloadDecoder: ComponentCandidates<PayloadDecoder>;
  readonly errorPayloadDecoder: ComponentCandidates<PayloadDecoder>;
  readonly transport: ComponentCandidates<Transport>;
  readonly monitors?: readonly InteractionMonitor[];
  readonly interactionId: string;
  readonly releaseResponse?: () => void | Promise<void>;
  readonly releaseContext?: () => void | Promise<void>;
}): Promise<ModelOutput> {
  const termination = createInteractionTermination();
  const releaseResponse = input.releaseResponse ?? (() => undefined);
  const releaseContext = input.releaseContext ?? (() => undefined);

  try {
    const output = await releaseInteractionContext({
      release: releaseContext,
      operation: () =>
        releaseInteractionResponse({
          release: releaseResponse,
          operation: () => runUnaryInteraction(input, termination),
        }),
    });
    termination.terminate({ kind: "complete", output });
    return output;
  } catch (caught) {
    const error = captureUnknownInteractionFailure(caught, "resolution");
    if (termination.current() === undefined) {
      termination.terminate({ kind: "error", error });
    }
    throw error;
  }
}

/**
 * Runs the stages that produce an output. Release is owned by the caller.
 *
 * @param input Pipeline input.
 * @param termination Machine that records the eventual terminal state.
 * @returns The assembled output.
 */
async function runUnaryInteraction(
  input: Parameters<typeof executeUnaryInteraction>[0],
  termination: ReturnType<typeof createInteractionTermination>,
): Promise<ModelOutput> {
  const normalized = requireValue(normalizeInteractionRequest(input.context), "validation");
  const validated = requireValue(
    validateR1Interaction({ context: normalized, mode: input.mode }),
    "validation",
  );
  const configuration = resolveInteractionConfiguration({
    context: validated,
    clientConfiguration: input.clientConfiguration,
    ...(input.integrationServiceAccess === undefined
      ? {}
      : { integrationServiceAccess: input.integrationServiceAccess }),
    sdkResourceLimits: input.sdkResourceLimits,
  });
  const signal = resolveInteractionDeadline({
    signal: resolveInteractionSignal(configuration),
    ...(validated.options.deadline === undefined ? {} : { deadline: validated.options.deadline }),
  });
  if (signal.aborted) {
    termination.terminate({ kind: "cancel", reason: signal.reason });
    throw captureUnknownInteractionFailure(signal.reason, "transport");
  }

  const integrationPlan = joinIntegrationBranches({
    ...(input.adapter === undefined ? {} : { adapter: input.adapter }),
    ...(input.resolver === undefined ? {} : { resolver: input.resolver }),
    target: configuration.target,
    task: validated.request.task.descriptor,
    mode: input.mode,
    policy: configuration.compatibilityPolicy,
  });
  const adapter = asAdapter(integrationPlan.taskProtocolAdapter);
  const serviceAccess = scheduleServiceAccessResolution({
    ...(input.serviceAccessResolver === undefined ? {} : { resolver: input.serviceAccessResolver }),
    ...(validated.options.serviceAccessOverride === undefined
      ? {}
      : { interactionOverride: validated.options.serviceAccessOverride }),
    ...(validated.request.serviceAccess === undefined
      ? {}
      : { requestAccess: validated.request.serviceAccess }),
    ...(input.clientConfiguration.defaultServiceAccess === undefined
      ? {}
      : { clientDefault: input.clientConfiguration.defaultServiceAccess }),
    ...(input.integrationServiceAccess === undefined
      ? {}
      : { integrationDefault: input.integrationServiceAccess }),
  });
  const prepared = requireValue(
    schedulePreparePlan({
      adapter,
      request: validated.request,
      mode: input.mode,
      policy: configuration.compatibilityPolicy,
    }),
    "planning",
  );
  const plan = requireValue(
    validateR1PlanScope({ mode: input.mode, plan: prepared }),
    "validation",
  );
  const componentSelection = scheduleComponentSelection({
    payloadEncoder: input.payloadEncoder,
    successPayloadDecoder: input.successPayloadDecoder,
    errorPayloadDecoder: input.errorPayloadDecoder,
    transport: input.transport,
  });
  const payloadEncoder = asEncoder(selectedComponent(componentSelection, payloadEncoderRoleId));
  const successPayloadDecoder = asDecoder(
    selectedComponent(componentSelection, successDecoderRoleId),
  );
  const errorPayloadDecoder = asDecoder(selectedComponent(componentSelection, errorDecoderRoleId));
  const transport = asTransport(selectedComponent(componentSelection, transportRoleId));
  scheduleTypeContractValidation({
    planTypeContract: plan.typeContract,
    ...(payloadEncoder.descriptor.typeContract === undefined
      ? {}
      : { payloadEncoder: payloadEncoder.descriptor.typeContract }),
    ...(transport.descriptor.typeContract === undefined
      ? {}
      : { transport: transport.descriptor.typeContract }),
    ...(successPayloadDecoder.descriptor.typeContract === undefined
      ? {}
      : { successPayloadDecoder: successPayloadDecoder.descriptor.typeContract }),
    ...(errorPayloadDecoder.descriptor.typeContract === undefined
      ? {}
      : { errorPayloadDecoder: errorPayloadDecoder.descriptor.typeContract }),
  });
  const capabilityResolution = scheduleCapabilityValidation({
    transportCapabilities: plan.transport.requiredCapabilities,
    modeComponents: plan.modeComponents,
    componentSelection,
  });
  const snapshot = freezeExecutionSnapshot({
    integrationPlan,
    componentSelection,
    resourceLimits: configuration.resourceLimits,
    taskProtocolAdapter: adapter,
    serviceAccessResolver: input.serviceAccessResolver ?? {
      descriptor: {
        name: "service-access-resolver",
        version: "1.0.0",
        capabilities: new Set(),
        source: "builtin",
      },
      resolve: () => serviceAccess,
    },
    payloadEncoder,
    successPayloadDecoder,
    errorPayloadDecoder,
    transport,
    authorizationHandlerResolver: input.authorizationHandlerResolver ?? {
      descriptor: {
        name: "authorization-handler-resolver",
        version: "1.0.0",
        capabilities: new Set(),
        source: "builtin",
      },
      resolve: (resolution) =>
        scheduleAuthorizationHandlerResolution({
          authorization: resolution.authorization,
          handlers: resolution.handlers,
        }),
    },
    authorizationHandlers: input.authorizationHandlers,
    capabilityResolution,
  });
  const requestPlan = requireValue(
    scheduleBuildRequest({
      adapter: snapshot.taskProtocolAdapter,
      request: validated.request,
      plan,
    }),
    "planning",
  );
  const encoded = requireValue(
    await scheduleEncodePayload({
      encoder: snapshot.payloadEncoder,
      payload: requestPlan.payload,
      context: { signal },
    }),
    "encoding",
  );
  const transportRequest = createTransportRequest(plan, encoded);
  const preAuthorizationSnapshot = schedulePreAuthorizationSnapshot(transportRequest);
  await schedulePreAuthorizationEvent({
    monitors: input.monitors ?? [],
    snapshot: preAuthorizationSnapshot,
    interactionId: input.interactionId,
  });
  const handler = scheduleAuthorizationHandlerResolution({
    ...(input.authorizationHandlerResolver === undefined
      ? {}
      : { resolver: input.authorizationHandlerResolver }),
    authorization: serviceAccess.authorization,
    handlers: snapshot.authorizationHandlers,
  });
  const credentialSource = readCredentialSource(serviceAccess.authorization);
  if (credentialSource !== undefined) {
    requireValue(
      await scheduleCredentialRead({ credentialSource, signal, transport: snapshot.transport }),
      "authorization",
    );
  }
  const authorized = requireValue(
    await scheduleApplyAuthorization({
      handler,
      request: transportRequest,
      authorization: serviceAccess.authorization,
      context: {
        interactionId: input.interactionId,
        target: configuration.target,
        endpoint: serviceAccess.endpoint,
        transportKind: plan.transport.transportKind ?? "transport.http",
        timestamp: { epochMilliseconds: Date.now() },
        bodySigningMode: "none",
        signal,
        extensions: {},
      },
      transport: snapshot.transport,
    }),
    "authorization",
  );
  const sent = requireValue(
    await scheduleTransportSend({
      transport: snapshot.transport,
      request: authorized,
      signal,
      ...(validated.options.deadline === undefined ? {} : { deadline: validated.options.deadline }),
      resourceLimits: snapshot.resourceLimits,
    }),
    "transport",
  );
  if (sent.metadata.outcome !== "success") {
    throw new ModelInteractionError({
      message: "The transport outcome was not a successful response.",
      category: "model_service",
      phase: "transport",
      code: "unexpected_transport_outcome",
      diagnostics: [],
    });
  }
  const successDecoder = scheduleSuccessDecoderBranch({
    outcome: sent.metadata.outcome,
    successPayloadDecoder: snapshot.successPayloadDecoder,
  });
  if (successDecoder === undefined) {
    throw new ModelInteractionError({
      message: "The success decoder branch did not select the pre-fixed decoder.",
      category: "invalid_component_configuration",
      phase: "decoding",
      code: "missing_success_decoder",
      diagnostics: [],
    });
  }
  requireValue(
    validateResponseContentType({
      ...(sent.metadata.mediaType === undefined ? {} : { mediaType: sent.metadata.mediaType }),
      decoder: successDecoder,
    }),
    "decoding",
  );
  const decoded = requireValue(
    await scheduleDecodePayload({
      decoder: successDecoder,
      bytes: sent.body,
      context: { signal },
    }),
    "decoding",
  );
  const parsed = requireValue(
    scheduleParseResponse({
      adapter: snapshot.taskProtocolAdapter,
      payload: decoded,
      metadata: sent.metadata,
    }),
    "response_parsing",
  );
  const output = scheduleModelOutputAssembly({
    request: validated.request,
    response: parsed,
    diagnostics: [],
  });
  await publishIsolatedMonitoringChain({
    monitors: input.monitors ?? [],
    event: {
      id: `${input.interactionId}:interaction.completed`,
      type: "interaction.completed",
      interactionId: input.interactionId,
      timestamp: { epochMilliseconds: Date.now() },
      payload: { status: output.status },
      metadata: {},
    },
    result: output,
  });
  return output;
}

/**
 * Returns the stage value or throws the stage's first diagnostic.
 *
 * @typeParam Value Successful stage value.
 * @param result Stage result. Absence of `value` is a failure.
 * @param phase Phase used when the result has no diagnostic.
 * @returns The stage value.
 */
function requireValue<Value>(result: ProcessingResult<Value>, phase: Diagnostic["phase"]): Value {
  if (result.value !== undefined) {
    return result.value;
  }
  const diagnostic = result.diagnostics[0];
  throw new ModelInteractionError({
    message: diagnostic?.message ?? "An interaction stage produced no value.",
    category: "invalid_request",
    phase: diagnostic?.phase ?? phase,
    code: diagnostic?.code ?? "interaction_stage_failed",
    diagnostics: result.diagnostics,
  });
}

/**
 * Finds the component selected for one role.
 *
 * @param selection Frozen selection for this interaction.
 * @param roleId Role that must be present.
 * @returns The selected component instance.
 */
function selectedComponent(
  selection: ComponentSelectionResolution,
  roleId: string,
): RuntimeComponent {
  const selected = selection.components.find((entry) => entry.role.id === roleId);
  if (selected === undefined) {
    throw new ModelInteractionError({
      message: "A required execution component was not selected.",
      category: "invalid_component_configuration",
      phase: "resolution",
      code: "component_not_found",
      diagnostics: [],
    });
  }
  return selected.component;
}

function asAdapter(component: RuntimeComponent): TaskProtocolAdapter {
  if (
    typeof component === "object" &&
    component !== null &&
    "supports" in component &&
    typeof component.supports === "function" &&
    "preparePlan" in component &&
    typeof component.preparePlan === "function" &&
    "buildRequest" in component &&
    typeof component.buildRequest === "function" &&
    "parseResponse" in component &&
    typeof component.parseResponse === "function" &&
    "parseError" in component &&
    typeof component.parseError === "function"
  ) {
    return component as TaskProtocolAdapter;
  }
  throw new TypeError("The integration plan does not contain a protocol adapter.");
}

/**
 * Narrows a selected component to an encoder.
 *
 * @param component Component selected for the encoder role.
 * @returns The same component as an encoder.
 */
function asEncoder(component: RuntimeComponent): PayloadEncoder {
  if (!("encode" in component) || typeof component.encode !== "function") {
    throw new TypeError("The selected encoder does not implement encode.");
  }
  return component as PayloadEncoder;
}

/**
 * Narrows a selected component to a decoder.
 *
 * @param component Component selected for a decoder role.
 * @returns The same component as a decoder.
 */
function asDecoder(component: RuntimeComponent): PayloadDecoder {
  if (!("decode" in component) || typeof component.decode !== "function") {
    throw new TypeError("The selected decoder does not implement decode.");
  }
  return component as PayloadDecoder;
}

/**
 * Narrows a selected component to a transport.
 *
 * @param component Component selected for the transport role.
 * @returns The same component as a transport.
 */
function asTransport(component: RuntimeComponent): Transport {
  if (!("send" in component) || typeof component.send !== "function") {
    throw new TypeError("The selected transport does not implement send.");
  }
  return component as Transport;
}

/**
 * Reads a credential source when the authorization description has one.
 *
 * @param authorization Resolved authorization description.
 * @returns The source, or `undefined` when this authorization has none.
 */
function readCredentialSource(authorization: Authorization): CredentialSource | undefined {
  if (!("credentialSource" in authorization)) {
    return undefined;
  }
  const source = authorization.credentialSource;
  if (
    typeof source === "object" &&
    source !== null &&
    "getCredential" in source &&
    typeof source.getCredential === "function"
  ) {
    return source as CredentialSource;
  }
  return undefined;
}

/**
 * Builds the encoded transport request from the protocol plan.
 *
 * The endpoint stays the service base and the operation path is appended once.
 * Query values stay in the query collection.
 *
 * @param plan Validated execution plan.
 * @param body Encoded request body.
 * @returns The request handed to authorization and then to the transport.
 */
function createTransportRequest(
  plan: ProtocolExecutionPlan,
  body: TransportRequest["body"],
): TransportRequest {
  const endpoint = plan.transportPlan.endpoint.value;
  const path = plan.transportPlan.path.startsWith("/")
    ? plan.transportPlan.path
    : `/${plan.transportPlan.path}`;
  const base = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  return {
    method: plan.transportPlan.method,
    url: { kind: "absolute", value: `${base}${path}` },
    headers: plan.transportPlan.headers,
    query: plan.transportPlan.query,
    body,
  };
}
