import {
  copyTimeToYmd,
  formatYmd,
  getZonedDayBounds,
  isValidIanaTimeZone,
  isWithinDayBounds,
  localDateTimeToUtc,
  normalizeTimeZone,
  zonedLocalToUtc,
} from './date-time.util';

describe('date-time.util', () => {
  it('accepts valid IANA timezones and rejects arbitrary strings', () => {
    expect(isValidIanaTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidIanaTimeZone('America/New_York')).toBe(true);
    expect(isValidIanaTimeZone('Europe/London')).toBe(true);
    expect(isValidIanaTimeZone('UTC')).toBe(true);
    expect(isValidIanaTimeZone('Not/A_Zone')).toBe(false);
    expect(isValidIanaTimeZone('EST')).toBe(false);
    expect(isValidIanaTimeZone('IST')).toBe(false);
    expect(isValidIanaTimeZone('GMT+5:30')).toBe(false);
  });

  it('falls back to UTC when timezone is missing or invalid', () => {
    expect(normalizeTimeZone(null)).toBe('UTC');
    expect(normalizeTimeZone('nope')).toBe('UTC');
    expect(normalizeTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata');
  });

  it('uses Asia/Kolkata midnight boundaries, not the server local zone', () => {
    const justBeforeIstMidnight = new Date('2026-08-17T18:29:59.000Z');
    const atIstMidnight = new Date('2026-08-17T18:30:00.000Z');

    const before = getZonedDayBounds(justBeforeIstMidnight, 'Asia/Kolkata');
    const after = getZonedDayBounds(atIstMidnight, 'Asia/Kolkata');

    expect(before.ymd).toBe('2026-08-17');
    expect(after.ymd).toBe('2026-08-18');
    expect(after.start.toISOString()).toBe('2026-08-17T18:30:00.000Z');
    expect(after.endExclusive.toISOString()).toBe('2026-08-18T18:30:00.000Z');

    expect(justBeforeIstMidnight < after.start).toBe(true);
    expect(atIstMidnight >= after.start).toBe(true);
    expect(atIstMidnight < after.endExclusive).toBe(true);
  });

  it('treats a due instant at Kolkata midnight as TODAY, not OVERDUE', () => {
    const now = new Date('2026-08-18T04:00:00.000Z');
    const bounds = getZonedDayBounds(now, 'Asia/Kolkata');
    const dueAtMidnight = zonedLocalToUtc('2026-08-18', 0, 0, 0, 'Asia/Kolkata');
    const dueYesterday = zonedLocalToUtc('2026-08-17', 23, 59, 0, 'Asia/Kolkata');

    expect(dueAtMidnight >= bounds.start && dueAtMidnight < bounds.endExclusive).toBe(
      true,
    );
    expect(dueYesterday < bounds.start).toBe(true);
  });

  it('does not count yesterday or future due dates as today', () => {
    const now = new Date('2026-08-18T10:00:00.000Z');
    const bounds = getZonedDayBounds(now, 'Asia/Kolkata');
    const yesterday = zonedLocalToUtc('2026-08-17', 16, 0, 0, 'Asia/Kolkata');
    const today = zonedLocalToUtc('2026-08-18', 16, 0, 0, 'Asia/Kolkata');
    const tomorrow = zonedLocalToUtc('2026-08-19', 9, 0, 0, 'Asia/Kolkata');

    expect(isWithinDayBounds(yesterday, bounds)).toBe(false);
    expect(isWithinDayBounds(today, bounds)).toBe(true);
    expect(isWithinDayBounds(tomorrow, bounds)).toBe(false);
    expect(isWithinDayBounds(null, bounds)).toBe(false);
  });

  it('converts local datetime in the user timezone to UTC', () => {
    const utc = localDateTimeToUtc('2026-08-18T09:30', 'Asia/Kolkata');
    expect(utc.toISOString()).toBe('2026-08-18T04:00:00.000Z');
  });

  it('copies wall-clock time onto the next occurrence date', () => {
    const source = zonedLocalToUtc('2026-08-18', 9, 30, 0, 'Asia/Kolkata');
    const shifted = copyTimeToYmd(source, '2026-08-19', 'Asia/Kolkata');
    expect(formatYmd(shifted, 'Asia/Kolkata')).toBe('2026-08-19');
    expect(shifted.toISOString()).toBe('2026-08-19T04:00:00.000Z');
  });
});
