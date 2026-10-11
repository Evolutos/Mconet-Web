// Copyright © 2026 Mcont.

/**
 * Public module boundary for the Node.js Fetch transport.
 *
 * The options contract names the Fetch function, dispatcher, and dispatcher
 * owner separately. The transport sends through Node's Fetch implementation
 * and does not close a dispatcher. Importing this module does not read
 * platform globals or call Fetch.
 */
export { NodeFetchTransport } from "./node-fetch-transport.js";
export type {
  NodeFetch,
  NodeFetchDispatcher,
  NodeFetchDispatcherOwnership,
  NodeFetchTransportOptions,
} from "./node-fetch-transport-options.js";
