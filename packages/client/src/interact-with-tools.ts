// Copyright © 2026 Mcont.

import {
  isTextMessageContent,
  type ConversationTaskResult,
  type MessageEntry,
  type MessageGroup,
  type ModelOutput,
  type ToolCall,
} from "@evolutos/mconet-core-domain";
import type { InteractionOptions } from "@evolutos/mconet-core-spi";

import {
  conversationRequest,
  type ConversationMessage,
  type ConversationRequestInput,
  type ConversationTool,
} from "./conversation-request.js";
import type { ModelInteractor } from "./model-interactor.js";

/**
 * Maximum model calls in one tool continuation.
 *
 * A function runs only when a later call can carry its result. The last allowed
 * model response is returned as-is when it still asks for tools.
 */
const maxToolCallRounds = 4;

/** Role identity that may request function calls. */
const assistantRoleId = "message.assistant";

/** Leaf discriminator for one message entry. */
const messageEntryKind = "message.entry";

/**
 * One declared function plus the application code that runs it.
 *
 * `execute` receives the model's raw argument text and returns the result text
 * that will be sent back. The helper does not parse the arguments.
 */
export interface ExecutableConversationTool extends ConversationTool {
  /** Runs one call and returns the result text. */
  readonly execute: (argumentsText: string) => string | Promise<string>;
}

/** One assistant turn that can be answered and sent back. */
interface ToolContinuationTurn {
  readonly calls: readonly ToolCall[];
  readonly text: string;
}

/** Message-tree element visited while looking for one tool request. */
type MessageElement = MessageGroup | MessageEntry;

/**
 * Sends a conversation, runs registered functions, and returns their results.
 *
 * Each round is one `interact` call. Continuation happens only when the output
 * status is `requires_action`, exactly one assistant entry requested tools, and
 * every requested name was registered. Those functions run and their text is
 * appended as tool turns. Any other output is returned unchanged. The helper
 * stops after four model calls.
 *
 * @param interactor Call surface that owns execution.
 * @param input Target, turns, and the functions that may run.
 * @param options Optional per-call overrides passed through unchanged.
 * @returns The last model output. It still requires action when a call remains.
 */
export async function interactWithTools(
  interactor: ModelInteractor,
  input: Omit<ConversationRequestInput, "tools"> & {
    readonly tools: readonly ExecutableConversationTool[];
  },
  options?: InteractionOptions,
): Promise<ModelOutput> {
  // Names are fixed for the whole continuation. A duplicate or a missing
  // implementation fails before the first model call.
  const handlers = handlersByName(input.tools);
  let messages: readonly ConversationMessage[] = input.messages;
  let output: ModelOutput | undefined;
  for (let round = 0; round < maxToolCallRounds; round += 1) {
    // Declarations are sent on every round so the model can call again after
    // it has read the previous result. The implementation stays off the request.
    const request = conversationRequest({
      target: input.target,
      messages,
      ...(input.serviceAccess === undefined ? {} : { serviceAccess: input.serviceAccess }),
      tools: input.tools.map((tool) => declaration(tool)),
    });
    output =
      options === undefined
        ? await interactor.interact(request)
        : await interactor.interact(request, options);
    const turn = continuationTurn(output);
    const lastRound = round === maxToolCallRounds - 1;
    // A partial set is not executed. The service expects one result for every
    // call id, and this round has no later call left to carry those results
    // when the cap has been reached.
    if (turn === undefined || lastRound || turn.calls.some((call) => !handlers.has(call.name))) {
      return output;
    }
    const results = await toolResults(turn.calls, handlers);
    messages = [
      ...messages,
      {
        role: "assistant",
        text: turn.text,
        toolCalls: turn.calls,
      },
      ...results,
    ];
  }
  // The loop returns on every iteration when the cap is positive. This guard
  // covers a zero cap, which performs no model call.
  if (output === undefined) {
    throw new TypeError("Tool continuation did not receive a model output.");
  }
  return output;
}

/**
 * Indexes registered functions and rejects two tools with the same name.
 *
 * @param tools Functions the caller allows this continuation to run.
 * @returns Those functions keyed by name.
 */
function handlersByName(
  tools: readonly ExecutableConversationTool[],
): ReadonlyMap<string, ExecutableConversationTool> {
  const handlers = new Map<string, ExecutableConversationTool>();
  for (const tool of tools) {
    // The request builder also rejects a repeated name. Checking here avoids a
    // model call that would fail while the request is assembled, and rejects a
    // declaration that has no function to run.
    if (handlers.has(tool.name) || typeof tool.execute !== "function") {
      throw new TypeError("Each tool continuation function needs one unique name and execute.");
    }
    handlers.set(tool.name, tool);
  }
  return handlers;
}

/**
 * Copies the declaration fields without the implementation.
 *
 * @param tool Registered function.
 * @returns The protocol-neutral declaration sent to the model.
 */
function declaration(tool: ExecutableConversationTool): ConversationTool {
  // `execute` is application code. Omitting an absent description keeps the
  // exact-optional member off the task node.
  return {
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    parameters: tool.parameters,
  };
}

/**
 * Returns the single assistant tool turn that may be answered.
 *
 * Continuation requires status `requires_action`. Several assistant entries
 * that each request tools are alternative choices, so none of them is run.
 * The returned text is only the text on the entry that owns the calls.
 *
 * @param output Model output from the latest round.
 * @returns That turn, or `undefined` when this output must be returned as-is.
 */
function continuationTurn(output: ModelOutput): ToolContinuationTurn | undefined {
  if (output.status !== "requires_action" || !isConversationResult(output.result)) {
    return undefined;
  }
  const turns = assistantToolTurns(output.result);
  if (turns.length !== 1) {
    return undefined;
  }
  return turns[0];
}

/**
 * Collects assistant entries that requested at least one function.
 *
 * Entries are visited in document preorder. An entry with no `toolCalls` list
 * stays in the document and does not become a continuation turn.
 *
 * @param result Conversation result from one model call.
 * @returns One turn per assistant entry that requested tools.
 */
function assistantToolTurns(result: ConversationTaskResult): readonly ToolContinuationTurn[] {
  const turns: ToolContinuationTurn[] = [];
  const pending: MessageElement[] = [result.messages.root];
  let element = pending.pop();
  while (element !== undefined) {
    if (isEntry(element)) {
      if (
        element.role.id === assistantRoleId &&
        element.toolCalls !== undefined &&
        element.toolCalls.length > 0
      ) {
        turns.push({ calls: element.toolCalls, text: entryText(element) });
      }
    } else {
      // Reverse a copy so the stack restores left-to-right child order.
      for (const child of element.children.slice().reverse()) {
        pending.push(child);
      }
    }
    element = pending.pop();
  }
  return turns;
}

/**
 * Joins the text content of one assistant entry.
 *
 * Non-text content is skipped. Segments keep their own spaces because the
 * separator is empty, matching conversation text projection.
 *
 * @param entry Assistant entry that requested tools.
 * @returns The text to repeat on the follow-up assistant message.
 */
function entryText(entry: MessageEntry): string {
  const segments: string[] = [];
  for (const content of entry.content) {
    if (isTextMessageContent(content)) {
      segments.push(content.text);
    }
  }
  return segments.join("");
}

/** Narrows one message element to a leaf entry. */
function isEntry(element: MessageElement): element is MessageEntry {
  return element.kind === messageEntryKind;
}

/** Narrows a task result to a conversation result that carries messages. */
function isConversationResult(result: ModelOutput["result"]): result is ConversationTaskResult {
  return result.descriptor.type === "conversation.generate" && "messages" in result;
}

/**
 * Runs each call and returns tool-result turns in the same order.
 *
 * Execution is serial so a thrown function leaves no partial tool transcript
 * to send. Argument text is passed through unchanged.
 *
 * @param calls Calls the assistant requested.
 * @param handlers Functions registered for this continuation.
 * @returns Tool messages whose text is the function result.
 */
async function toolResults(
  calls: readonly ToolCall[],
  handlers: ReadonlyMap<string, ExecutableConversationTool>,
): Promise<readonly ConversationMessage[]> {
  const messages: ConversationMessage[] = [];
  for (const call of calls) {
    const handler = handlers.get(call.name);
    // The caller already required every name to be registered. A missing
    // handler means that check and this map diverged.
    if (handler === undefined) {
      throw new TypeError("Tool continuation lost a registered function.");
    }
    const text = await handler.execute(call.arguments);
    if (typeof text !== "string") {
      throw new TypeError("Tool execute must return a string.");
    }
    messages.push({ role: "tool", text, toolCallId: call.id });
  }
  return messages;
}
