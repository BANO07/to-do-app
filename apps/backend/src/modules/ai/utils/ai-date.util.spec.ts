import { getNextUtcMidnight, getUtcUsageDate } from './ai-date.util';

describe('ai-date.util', () => {
  const fixedNow = new Date('2026-08-19T15:30:00.000Z');

  it('returns the UTC calendar date', () => {
    expect(getUtcUsageDate(fixedNow)).toBe('2026-08-19');
  });

  it('returns the next UTC midnight boundary', () => {
    expect(getNextUtcMidnight(fixedNow)).toEqual(
      new Date('2026-08-20T00:00:00.000Z'),
    );
  });
});
