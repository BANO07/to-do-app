import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OAuth2Client } from 'google-auth-library';
import { CalendarConnectionService } from './calendar-connection.service';
import { CalendarConnectionRepository } from './calendar-connection.repository';
import { CalendarEventRepository } from './calendar-event.repository';
import { CalendarEventStatus } from '../../common/enums/calendar-event-status.enum';
import { SyncCalendarResult } from './dto/calendar.dto';

interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  recurringEventId?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
}

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);
  private readonly CALENDAR_EVENTS_URL =
    'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  constructor(
    private readonly connectionService: CalendarConnectionService,
    private readonly connectionRepo: CalendarConnectionRepository,
    private readonly eventRepo: CalendarEventRepository,
  ) {}

  /** Manual sync triggered by the user via GraphQL mutation */
  async syncForUser(userId: string): Promise<SyncCalendarResult> {
    const client = await this.connectionService.getReadyClient(userId);
    if (!client) {
      return { success: false, eventsUpserted: 0, message: 'Calendar not connected or token expired.' };
    }

    const conn = await this.connectionRepo.findActiveByUserId(userId);
    if (!conn) {
      return { success: false, eventsUpserted: 0, message: 'No active calendar connection.' };
    }

    try {
      const count = await this.fetchAndUpsertEvents(userId, conn.id, client);
      this.logger.log(`[CalendarSync] userId=${userId} synced ${count} events`);
      return { success: true, eventsUpserted: count };
    } catch (err) {
      this.logger.error(
        `[CalendarSync] Sync failed for userId=${userId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return { success: false, eventsUpserted: 0, message: 'Sync failed. Please try again.' };
    }
  }

  /** Background sync every 30 minutes for all active connections */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async backgroundSync(): Promise<void> {
    const connections = await this.connectionRepo.findAllActive();
    this.logger.log(`[CalendarSync] Background sync: ${connections.length} connections`);

    for (const conn of connections) {
      try {
        const client = await this.connectionService.getReadyClient(conn.userId);
        if (!client) continue;
        const count = await this.fetchAndUpsertEvents(conn.userId, conn.id, client);
        this.logger.log(
          `[CalendarSync] Background: userId=${conn.userId} synced ${count} events`,
        );
      } catch (err) {
        this.logger.warn(
          `[CalendarSync] Background sync failed for userId=${conn.userId}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }
  }

  private async fetchAndUpsertEvents(
    userId: string,
    connectionId: string,
    client: OAuth2Client,
  ): Promise<number> {
    const response = await client.getAccessToken();
    const token = response.token;
    if (!token) throw new Error('No access token available');

    // Sync events from 30 days ago to 90 days in the future
    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    let upsertCount = 0;
    let pageToken: string | undefined;
    const seenProviderIds: string[] = [];
    const syncedBefore = now;

    do {
      const url = new URL(this.CALENDAR_EVENTS_URL);
      url.searchParams.set('timeMin', timeMin);
      url.searchParams.set('timeMax', timeMax);
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('maxResults', '250');
      url.searchParams.set('orderBy', 'startTime');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Google Calendar API error ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json() as GoogleCalendarListResponse;
      const items = data.items ?? [];

      for (const item of items) {
        if (!item.id) continue;
        seenProviderIds.push(item.id);

        const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
        const startAt = item.start?.dateTime
          ? new Date(item.start.dateTime)
          : item.start?.date
          ? new Date(item.start.date + 'T00:00:00Z')
          : new Date();
        const endAt = item.end?.dateTime
          ? new Date(item.end.dateTime)
          : item.end?.date
          ? new Date(item.end.date + 'T23:59:59Z')
          : new Date();

        const status = this.mapStatus(item.status ?? 'confirmed');

        await this.eventRepo.upsertEvent({
          userId,
          connectionId,
          providerEventId: item.id,
          calendarId: 'primary',
          title: item.summary ?? '(No title)',
          description: item.description ?? null,
          startAt,
          endAt,
          isAllDay,
          timezone: item.start?.timeZone ?? null,
          location: item.location ?? null,
          status,
          recurrenceId: item.recurringEventId ?? null,
        });

        upsertCount++;
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    // Mark events not seen in this sync as cancelled
    if (seenProviderIds.length > 0) {
      await this.eventRepo.markCancelledByConnectionId(
        connectionId,
        seenProviderIds,
        syncedBefore,
      );
    }

    return upsertCount;
  }

  private mapStatus(googleStatus: string): CalendarEventStatus {
    switch (googleStatus) {
      case 'tentative':
        return CalendarEventStatus.TENTATIVE;
      case 'cancelled':
        return CalendarEventStatus.CANCELLED;
      default:
        return CalendarEventStatus.CONFIRMED;
    }
  }
}
