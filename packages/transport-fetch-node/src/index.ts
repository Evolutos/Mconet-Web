// Copyright © 2026 Mcont.

/**
 * Public module boundary for the Node.js Fetch transport.
 *
 * The options contract names the Fetch function, dispatcher, and dispatcher
 * owner separately. The transport sends through Node's Fetch implementation.
 * Closing it releases an SDK-owned dispatcher once and leaves an
 * application-owned dispatcher open. Importing this module does not read
 * platform globals, call Fetch, or close a dispatcher.
 */
export { NodeFetchTransport } from "./node-fetch-transport.js";
export type {
  NodeFetch,
  NodeFetchDispatcher,
  NodeFetchDispatcherOwnership,
  NodeFetchTransportOptions,
} from "./node-fetch-transport-options.js";
