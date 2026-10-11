// Copyright © 2026 Mcont.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Controllable Node HTTP server for Fetch transport integration tests.
 *
 * The handler owns each response, so a test can choose the status, headers,
 * body, delay, redirect, or a truncated stream. This module is not a transport.
 */
export interface NodeFetchTestServer {
  /** Absolute origin bound on the loopback interface, without a path. */
  readonly origin: string;

  /**
   * Stops accepting connections and closes sockets that are still open.
   *
   * @returns A promise that settles when the server has closed.
   */
  close(): Promise<void>;
}

/**
 * Handles one request. The handler must finish or destroy `response`.
 */
export type NodeFetchTestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void | Promise<void>;

/**
 * Starts a loopback HTTP server whose handler decides every response.
 *
 * @param handler Per-request response controller.
 * @returns The bound server.
 */
export async function startNodeFetchTestServer(
  handler: NodeFetchTestHandler,
): Promise<NodeFetchTestServer> {
  const server = createServer((request, response) => {
    void Promise.resolve()
      .then(() => handler(request, response))
      .catch((error: unknown) => {
        if (!response.headersSent) {
          response.writeHead(500);
        }

        response.destroy(error instanceof Error ? error : undefined);
      });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const address = server.address();

  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Node Fetch test server did not bind a TCP port.");
  }

  return {
    origin: originForAddress(address),
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
        server.closeAllConnections();
      });
    },
  };
}

/**
 * Formats the loopback origin for an accepted TCP address.
 *
 * @param address Bound server address.
 * @returns Absolute HTTP origin.
 */
function originForAddress(address: AddressInfo): string {
  return `http://127.0.0.1:${address.port}`;
}
