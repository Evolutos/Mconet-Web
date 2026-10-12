// Copyright © 2026 Mcont.

import type { ResolvedInteractionConfiguration } from "./resolved-interaction-configuration.js";
import { composeAbortSignals } from "./compose-abort-signals.js";

/**
 * Schedules the cancellation signal for one interaction.
 *
 * The caller signal is the only source. Aborting it aborts the returned signal
 * with the same reason. A missing caller signal still returns a distinct signal
 * that is not aborted. This stage does not read a deadline or call a transport.
 *
 * @param configuration Resolved configuration whose signal is the caller source.
 * @returns The signal later stages must observe.
 */
export function resolveInteractionSignal(
  configuration: ResolvedInteractionConfiguration,
): AbortSignal {
  // One source keeps caller priority without installing a second listener here.
  return composeAbortSignals(configuration.signal, undefined);
}
