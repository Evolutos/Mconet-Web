// Copyright © 2026 Mcont.

/**
 * Fetch implementation the Node transport may call.
 *
 * The signature matches Node's global `fetch`. Naming the function does not
 * read `globalThis` or send a request.
 */
export type NodeFetch = typeof globalThis.fetch;

/**
 * Connection resource the Node transport may reuse.
 *
 * The transport does not infer who closes this object. Ownership is a separate
 * option so an injected dispatcher is not treated as SDK-owned.
 */
export interface NodeFetchDispatcher {
  /** Releases the connection resource when its owner closes it. */
  close(): void | Promise<void>;
}

/**
 * Who is responsible for closing a dispatcher.
 *
 * `application` means the caller keeps the resource after the transport closes.
 * `sdk` means the transport closes a resource it created. The choice is not a
 * Fetch function and it is not the dispatcher itself.
 */
export type NodeFetchDispatcherOwnership = "application" | "sdk";

/**
 * Caller-supplied Node Fetch settings.
 *
 * The Fetch function, dispatcher, and dispatcher ownership are separate fields.
 * Replacing `fetch` cannot select a dispatcher or an owner, and naming an owner
 * cannot supply either object. This contract does not read platform globals,
 * call Fetch, or close a dispatcher.
 */
export interface NodeFetchTransportOptions {
  /** Optional Fetch function. Omission does not select a dispatcher or an owner. */
  readonly fetch?: NodeFetch;

  /** Optional connection resource. Omission does not select a Fetch function or an owner. */
  readonly dispatcher?: NodeFetchDispatcher;

  /** Optional owner of `dispatcher`. Omission does not select a Fetch function or a dispatcher. */
  readonly dispatcherOwnership?: NodeFetchDispatcherOwnership;
}
