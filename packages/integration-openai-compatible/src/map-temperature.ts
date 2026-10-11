// Copyright © 2026 Mcont.

import type { CompatibilityPolicy, ProcessingResult } from "@evolutos/mconet-core-domain";

/** Stable code when temperature cannot be sent unchanged. */
const temperatureOutOfRangeCode = "temperature_out_of_range";

/**
 * Highest temperature this chat-completions protocol accepts.
 *
 * The domain allows any finite non-negative temperature. This ceiling is the
 * protocol limit, not a domain limit.
 */
const maximumChatTemperature = 2;

/** Lowest temperature this protocol accepts. */
const minimumChatTemperature = 0;

/**
 * Temperature member to place on a request, or an empty result when it is omitted.
 *
 * `temperature` is absent when the caller did not set one. A present number is
 * copied exactly, including zero. Values outside the protocol range are not
 * clamped: strict planning fails, and compatible or permissive planning omits
 * the member and records a warning.
 */
export interface MappedTemperature {
  /** Temperature to send, absent when the request should leave the service default. */
  readonly temperature?: number;
}

/**
 * Maps one generation temperature onto the chat-completions request field.
 *
 * @param temperature Caller temperature, or `undefined` when the control was omitted.
 * @param policy Compatibility policy that decides an out-of-range value.
 * @returns The request member, or diagnostics and no value when strict mode rejects it.
 */
export function mapTemperatureToWire(
  temperature: number | undefined,
  policy: CompatibilityPolicy,
): ProcessingResult<MappedTemperature> {
  // Omission is not zero and not a failure. The request simply leaves the member out.
  if (temperature === undefined) {
    return { value: Object.freeze({}), diagnostics: [] };
  }
  if (isSendableTemperature(temperature)) {
    return { value: Object.freeze({ temperature }), diagnostics: [] };
  }

  const diagnostic = {
    code: temperatureOutOfRangeCode,
    severity: policy.mode === "strict" ? ("error" as const) : ("warning" as const),
    phase: "planning" as const,
    message: "Temperature is outside the chat completions range and was not rewritten.",
    path: "temperature",
  };
  // Strict mode refuses the request. Other modes omit the member instead of
  // clamping it to a different number.
  if (policy.mode === "strict") {
    return { diagnostics: [diagnostic] };
  }
  return { value: Object.freeze({}), diagnostics: [diagnostic] };
}

/**
 * Returns whether a temperature can be written without changing its value.
 *
 * @param temperature Candidate temperature.
 * @returns Whether it is a finite number in the protocol's inclusive range.
 */
function isSendableTemperature(temperature: number): boolean {
  return (
    typeof temperature === "number" &&
    Number.isFinite(temperature) &&
    !Object.is(temperature, -0) &&
    temperature >= minimumChatTemperature &&
    temperature <= maximumChatTemperature
  );
}
