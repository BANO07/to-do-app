const DEFAULT_TIMEZONE = 'UTC';

export function isValidIanaTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > 64 || /\s/.test(timeZone)) {
    return false;
  }

  if (timeZone !== 'UTC' && !timeZone.includes('/')) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(timeZone?: string | null): string {
  if (timeZone && isValidIanaTimeZone(timeZone)) {
    return timeZone;
  }
  return DEFAULT_TIMEZONE;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const read = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

export function formatYmd(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, normalizeTimeZone(timeZone));
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

export function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Convert a wall-clock date/time in `timeZone` to a UTC Date.
 * Stored DB timestamps remain timestamptz (UTC instant).
 */
export function zonedLocalToUtc(
  ymd: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const tz = normalizeTimeZone(timeZone);
  const [year, month, day] = ymd.split('-').map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  let utcMs = wanted;

  for (let i = 0; i < 4; i++) {
    const parts = getZonedParts(new Date(utcMs), tz);
    const asLocal = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    utcMs += wanted - asLocal;
  }

  return new Date(utcMs);
}

export interface DayBounds {
  start: Date;
  endExclusive: Date;
  ymd: string;
}

export function isWithinDayBounds(
  date: Date | null | undefined,
  bounds: DayBounds,
): boolean {
  if (!date) {
    return false;
  }
  return date >= bounds.start && date < bounds.endExclusive;
}

/** Inclusive start / exclusive end of the calendar day in the given IANA zone. */
export function getZonedDayBounds(
  now: Date,
  timeZone?: string | null,
): DayBounds {
  const tz = normalizeTimeZone(timeZone);
  const ymd = formatYmd(now, tz);
  const start = zonedLocalToUtc(ymd, 0, 0, 0, tz);
  const nextYmd = addDaysYmd(ymd, 1);
  const endExclusive = zonedLocalToUtc(nextYmd, 0, 0, 0, tz);
  return { start, endExclusive, ymd };
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Copy the wall-clock time of `source` onto a civil date in the same IANA zone. */
export function copyTimeToYmd(
  source: Date,
  ymd: string,
  timeZone: string,
): Date {
  const tz = normalizeTimeZone(timeZone);
  const parts = getZonedParts(source, tz);
  return zonedLocalToUtc(ymd, parts.hour, parts.minute, parts.second, tz);
}

export function parseLocalDateTime(
  value: string,
): { ymd: string; hour: number; minute: number } | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  return {
    ymd: match[1],
    hour: Number(match[2]),
    minute: Number(match[3]),
  };
}

export function localDateTimeToUtc(value: string, timeZone: string): Date {
  const parsed = parseLocalDateTime(value);
  if (!parsed) {
    throw new Error('Invalid local datetime');
  }
  return zonedLocalToUtc(
    parsed.ymd,
    parsed.hour,
    parsed.minute,
    0,
    timeZone,
  );
}

export const DEFAULT_IANA_TIMEZONE = DEFAULT_TIMEZONE;
