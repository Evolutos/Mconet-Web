// Copyright © 2026 Mcont.

import type { BytesTransportBody } from "./bytes-transport-body.js";

/**
 * Request-body union shared by payload encoders and transports.
 *
 * The initial unary implementation intentionally exposes only the complete
 * buffered-bytes branch. Keeping the port name separate from its current branch
 * lets future implemented stream or multipart variants extend this union without
 * changing encoder and transport signatures or weakening bytes semantics.
 */
export type TransportBody = BytesTransportBody;
