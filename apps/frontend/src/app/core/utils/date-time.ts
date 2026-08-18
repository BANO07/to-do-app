const DEFAULT_TIMEZONE = 'UTC';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function getZonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);

  const read = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  };
}

export function toZonedDatetimeLocal(iso: string, timeZone: string): string {
  const parts = getZonedParts(new Date(iso), timeZone || DEFAULT_TIMEZONE);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function zonedDatetimeLocalToIso(local: string, timeZone: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!match) {
    return new Date(local).toISOString();
  }

  const ymd = match[1];
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const [year, month, day] = ymd.split('-').map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utcMs = wanted;
  const tz = timeZone || DEFAULT_TIMEZONE;

  for (let i = 0; i < 4; i++) {
    const parts = getZonedParts(new Date(utcMs), tz);
    const asLocal = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0,
    );
    utcMs += wanted - asLocal;
  }

  return new Date(utcMs).toISOString();
}

export const COMMON_TIMEZONES = [
  'UTC',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export function listIanaTimezones(): string[] {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf?.('timeZone');
  if (supported?.length) {
    return supported;
  }
  return COMMON_TIMEZONES;
}
