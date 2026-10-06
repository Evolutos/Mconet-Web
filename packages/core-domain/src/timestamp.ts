// Copyright © 2026 Mcont.

/**
 * UTC instant represented as signed whole milliseconds from the Unix epoch.
 *
 * Millisecond precision is shared by browser and Node.js runtimes and is safe
 * to serialize as a JSON number within the safe-integer range. Construction
 * from untrusted values must use the dedicated parser, which enforces finiteness,
 * integer precision, and range without exposing a mutable `Date` instance.
 */
export interface Timestamp {
  /** Signed whole milliseconds since 1970-01-01T00:00:00.000Z. */
  readonly epochMilliseconds: number;
}

/** Strict timestamp syntax with an explicit, known UTC offset. */
const timestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/u;

/** Number of milliseconds in one minute. */
const millisecondsPerMinute = 60_000;

/**
 * Parses an untrusted RFC 3339 timestamp without relying on implementation-
 * specific string parsing.
 *
 * The accepted form uses a four-digit Gregorian year, required seconds, an
 * explicit `Z` or numeric UTC offset, and at most millisecond precision. Invalid
 * input returns `undefined`; precision is never rounded or truncated.
 *
 * @param value Untrusted value to parse.
 * @returns A normalized UTC timestamp, or `undefined` when validation fails.
 */
export function parseTimestamp(value: unknown): Timestamp | undefined {
  // Refuse coercion so objects, numbers, and other primitives cannot acquire an
  // implementation-dependent timestamp interpretation.
  if (typeof value !== "string") {
    return undefined;
  }

  // Match the complete strict syntax before extracting fields; partial matches
  // cannot reach calendar arithmetic.
  const match = timestampPattern.exec(value);
  if (!match) {
    return undefined;
  }

  // Convert every decimal capture and retain fraction/zone text for their
  // dedicated precision and offset validation.
  const year = readDecimalPart(match[1]);
  const month = readDecimalPart(match[2]);
  const day = readDecimalPart(match[3]);
  const hour = readDecimalPart(match[4]);
  const minute = readDecimalPart(match[5]);
  const second = readDecimalPart(match[6]);
  const fraction = match[7] ?? "";
  const zone = match[8];

  // Validate Gregorian date and clock ranges explicitly instead of allowing
  // Date to roll invalid source values into another instant.
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined ||
    zone === undefined ||
    year === 0 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return undefined;
  }

  // Right-pad accepted fractions to milliseconds and resolve the explicit zone
  // separately so neither operation rounds or truncates input.
  const millisecond = fraction.length === 0 ? 0 : Number(fraction.padEnd(3, "0"));
  const offsetMinutes = readOffsetMinutes(zone, match[9], match[10], match[11]);
  if (offsetMinutes === undefined) {
    return undefined;
  }

  // Set UTC fields explicitly so years below 100 are not remapped by the
  // multi-argument Date constructor.
  const utcDate = new Date(0);
  utcDate.setUTCFullYear(year, month - 1, day);
  utcDate.setUTCHours(hour, minute, second, millisecond);

  // Convert the stated local offset to UTC and keep only instants exactly
  // representable by the public safe-integer contract.
  const epochMilliseconds = utcDate.getTime() - offsetMinutes * millisecondsPerMinute;
  if (!Number.isSafeInteger(epochMilliseconds)) {
    return undefined;
  }

  return { epochMilliseconds };
}

/**
 * Converts one required decimal capture to an integer.
 *
 * @param value Regular-expression capture.
 * @returns Parsed integer, or `undefined` for a missing capture.
 */
function readDecimalPart(value: string | undefined): number | undefined {
  // Captures already contain decimal digits; preserve a missing capture as
  // undefined instead of coercing it to zero.
  return value === undefined ? undefined : Number(value);
}

/**
 * Resolves a validated zone to signed minutes east of UTC.
 *
 * RFC 3339 `-00:00` communicates an unknown local offset, so it cannot identify
 * a UTC instant and is rejected instead of being treated as `Z`.
 *
 * @param zone Complete zone capture.
 * @param sign Numeric-offset sign capture.
 * @param hourText Offset-hour capture.
 * @param minuteText Offset-minute capture.
 * @returns Signed offset minutes, or `undefined` for an invalid/unknown offset.
 */
function readOffsetMinutes(
  zone: string,
  sign: string | undefined,
  hourText: string | undefined,
  minuteText: string | undefined,
): number | undefined {
  // The UTC designator resolves directly without numeric offset captures.
  if (zone === "Z") {
    return 0;
  }

  // Reject missing pieces, out-of-range units, and the unknown-offset sentinel
  // before calculating signed minutes.
  const hour = readDecimalPart(hourText);
  const minute = readDecimalPart(minuteText);
  if (
    (sign !== "+" && sign !== "-") ||
    hour === undefined ||
    minute === undefined ||
    hour > 23 ||
    minute > 59 ||
    (sign === "-" && hour === 0 && minute === 0)
  ) {
    return undefined;
  }

  // Combine validated units and apply the sign as minutes east of UTC.
  const absoluteMinutes = hour * 60 + minute;
  return sign === "+" ? absoluteMinutes : -absoluteMinutes;
}

/**
 * Returns the number of days in a Gregorian calendar month.
 *
 * @param year Four-digit Gregorian year.
 * @param month One-based month.
 */
function daysInMonth(year: number, month: number): number {
  // February is the only month whose length depends on the supplied year.
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  // Enumerate the four thirty-day months; every other validated month has 31.
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** Determines whether a Gregorian calendar year contains February 29. */
function isLeapYear(year: number): boolean {
  // Gregorian years divide by four except centuries, while centuries divisible
  // by four hundred regain leap-year status.
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
