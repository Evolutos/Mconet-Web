// Copyright © 2026 Mcont.

import type { Bytes } from "@evolutos/mconet-core-domain";

/**
 * Buffered byte body accepted by the initial unary transport pipeline.
 *
 * The fixed discriminator reserves a stable union branch for future streaming
 * or multipart bodies without changing byte-body semantics. The byte view is
 * retained exactly as supplied and is not encoded, copied, consumed, signed,
 * decoded, or frozen. Readonly protects the view reference, not its backing data.
 */
export interface BytesTransportBody {
  /** Fixed transport-body branch for a complete buffered byte sequence. */
  readonly kind: "bytes";

  /** Caller-owned byte view retained without copying or interpretation. */
  readonly bytes: Bytes;
}
