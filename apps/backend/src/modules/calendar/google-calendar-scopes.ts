/**
 * Google Calendar OAuth scopes used by CalendarConnectionService.
 * calendar.events is the minimum write scope for insert/update/delete
 * on the user's calendars (without full calendar management).
 */
export const GOOGLE_CALENDAR_EVENTS_SCOPE =
  'https://www.googleapis.com/auth/calendar.events';

export const GOOGLE_CALENDAR_READONLY_SCOPE =
  'https://www.googleapis.com/auth/calendar.readonly';

/** Full calendar scope also grants event write access. */
export const GOOGLE_CALENDAR_FULL_SCOPE =
  'https://www.googleapis.com/auth/calendar';

export const GOOGLE_USERINFO_EMAIL_SCOPE =
  'https://www.googleapis.com/auth/userinfo.email';

export const GOOGLE_CALENDAR_OAUTH_SCOPES = [
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  GOOGLE_USERINFO_EMAIL_SCOPE,
] as const;

/** True when the granted scope list can create/update/delete events. */
export function hasGoogleCalendarWriteScope(scopes: string[] | null | undefined): boolean {
  if (!scopes?.length) {
    return false;
  }
  return scopes.some(
    (scope) =>
      scope === GOOGLE_CALENDAR_EVENTS_SCOPE ||
      scope === GOOGLE_CALENDAR_FULL_SCOPE,
  );
}
