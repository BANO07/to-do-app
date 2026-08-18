import { RecurrenceFrequency } from '../enums/recurrence-frequency.enum';
import { nextOccurrenceDate } from './recurrence.util';

describe('recurrence.util', () => {
  it('advances daily by interval', () => {
    expect(
      nextOccurrenceDate('2026-08-18', {
        frequency: RecurrenceFrequency.DAILY,
        interval: 1,
      }),
    ).toBe('2026-08-19');
  });

  it('skips weekends for weekdays frequency', () => {
    expect(
      nextOccurrenceDate('2026-08-21', {
        frequency: RecurrenceFrequency.WEEKDAYS,
        interval: 1,
      }),
    ).toBe('2026-08-24');
  });

  it('advances weekly and biweekly', () => {
    expect(
      nextOccurrenceDate('2026-08-18', {
        frequency: RecurrenceFrequency.WEEKLY,
        interval: 1,
      }),
    ).toBe('2026-08-25');
    expect(
      nextOccurrenceDate('2026-08-18', {
        frequency: RecurrenceFrequency.BIWEEKLY,
        interval: 1,
      }),
    ).toBe('2026-09-01');
  });

  it('clamps monthly day when the next month is shorter', () => {
    expect(
      nextOccurrenceDate('2026-01-31', {
        frequency: RecurrenceFrequency.MONTHLY,
        interval: 1,
        dayOfMonth: 31,
      }),
    ).toBe('2026-02-28');
  });

  it('returns null when the next date is after endDate', () => {
    expect(
      nextOccurrenceDate('2026-08-18', {
        frequency: RecurrenceFrequency.DAILY,
        interval: 1,
        endDate: '2026-08-18',
      }),
    ).toBeNull();
  });

  it('does not return the same occurrence date (identity stays unique)', () => {
    const from = '2026-08-18';
    const next = nextOccurrenceDate(from, {
      frequency: RecurrenceFrequency.WEEKLY,
      interval: 1,
    });
    expect(next).not.toBe(from);
  });
});
