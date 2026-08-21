import {
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  GOOGLE_CALENDAR_FULL_SCOPE,
  GOOGLE_CALENDAR_READONLY_SCOPE,
  hasGoogleCalendarWriteScope,
} from './google-calendar-scopes';

describe('hasGoogleCalendarWriteScope', () => {
  it('returns true for calendar.events', () => {
    expect(hasGoogleCalendarWriteScope([GOOGLE_CALENDAR_EVENTS_SCOPE])).toBe(true);
  });

  it('returns true for full calendar scope', () => {
    expect(hasGoogleCalendarWriteScope([GOOGLE_CALENDAR_FULL_SCOPE])).toBe(true);
  });

  it('returns false for readonly-only grants', () => {
    expect(hasGoogleCalendarWriteScope([GOOGLE_CALENDAR_READONLY_SCOPE])).toBe(
      false,
    );
  });

  it('returns false for empty scopes', () => {
    expect(hasGoogleCalendarWriteScope([])).toBe(false);
    expect(hasGoogleCalendarWriteScope(undefined)).toBe(false);
  });
});
