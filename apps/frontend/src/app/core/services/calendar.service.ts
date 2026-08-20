import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { map, Observable } from 'rxjs';
import {
  CALENDAR_AUTH_URL_QUERY,
  CALENDAR_CONNECTION_QUERY,
  CALENDAR_EVENTS_QUERY,
  DISCONNECT_CALENDAR_MUTATION,
  SYNC_CALENDAR_MUTATION,
  TODAY_CALENDAR_EVENTS_QUERY,
} from '../graphql/operations';
import {
  CalendarConnectionStatus,
  CalendarEvent,
  SyncCalendarResult,
} from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  constructor(private readonly apollo: Apollo) {}

  getConnection(): Observable<CalendarConnectionStatus> {
    return this.apollo
      .query<{ calendarConnection: CalendarConnectionStatus }>({
        query: CALENDAR_CONNECTION_QUERY,
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data.calendarConnection));
  }

  getAuthUrl(): Observable<string> {
    return this.apollo
      .query<{ calendarAuthUrl: string }>({
        query: CALENDAR_AUTH_URL_QUERY,
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data.calendarAuthUrl));
  }

  getEvents(from: string, to: string): Observable<CalendarEvent[]> {
    return this.apollo
      .query<{ calendarEvents: CalendarEvent[] }>({
        query: CALENDAR_EVENTS_QUERY,
        variables: { input: { from, to } },
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data.calendarEvents));
  }

  getTodayEvents(): Observable<CalendarEvent[]> {
    return this.apollo
      .query<{ todayCalendarEvents: CalendarEvent[] }>({
        query: TODAY_CALENDAR_EVENTS_QUERY,
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data.todayCalendarEvents));
  }

  disconnect(): Observable<boolean> {
    return this.apollo
      .mutate<{ disconnectCalendar: boolean }>({
        mutation: DISCONNECT_CALENDAR_MUTATION,
      })
      .pipe(map((r) => r.data?.disconnectCalendar ?? false));
  }

  sync(): Observable<SyncCalendarResult> {
    return this.apollo
      .mutate<{ syncCalendar: SyncCalendarResult }>({
        mutation: SYNC_CALENDAR_MUTATION,
      })
      .pipe(map((r) => r.data?.syncCalendar ?? { success: false, eventsUpserted: 0 }));
  }
}
