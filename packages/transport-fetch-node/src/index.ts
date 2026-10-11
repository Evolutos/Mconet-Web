// Copyright © 2026 Mcont.

/**
 * Public module boundary for the Node.js Fetch transport.
 *
 * The options contract names the Fetch function, dispatcher, and dispatcher
 * owner separately. Importing this module does not read platform globals,
 * call Fetch, or close a dispatcher.
 */
export type {
  NodeFetch,
  NodeFetchDispatcher,
  NodeFetchDispatcherOwnership,
  NodeFetchTransportOptions,
} from "./node-fetch-transport-options.js";
