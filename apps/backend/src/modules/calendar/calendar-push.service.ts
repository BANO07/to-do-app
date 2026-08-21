import { Injectable, Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { CalendarConnectionService } from './calendar-connection.service';
import { Task } from '../tasks/entities/task.entity';
import { hasGoogleCalendarWriteScope } from './google-calendar-scopes';

const PRIMARY_CALENDAR_ID = 'primary';
const EVENTS_BASE =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';
/** V1 default duration when the Todo model has no duration field. */
const DEFAULT_EVENT_DURATION_MS = 30 * 60 * 1000;

type GoogleEventResource = {
  id?: string;
  summary?: string;
  description?: string | null;
  start?: { dateTime?: string; timeZone?: string; date?: string };
  end?: { dateTime?: string; timeZone?: string; date?: string };
};

@Injectable()
export class CalendarPushService {
  private readonly logger = new Logger(CalendarPushService.name);

  constructor(
    private readonly connectionService: CalendarConnectionService,
  ) {}

  /**
   * Create a Google Calendar event for a task with a due date.
   * Returns the Google event id, or null when skipped / failed.
   * Idempotent: if task.googleEventId is already set, returns it without inserting.
   */
  async createEventForTask(
    userId: string,
    task: Task,
    timeZone: string,
  ): Promise<string | null> {
    if (task.googleEventId) {
      return task.googleEventId;
    }
    if (!task.dueDate) {
      return null;
    }

    const client = await this.getWritableClient(userId);
    if (!client) {
      return null;
    }

    const body = this.buildEventBody(task, timeZone);
    try {
      const accessToken = await this.getAccessToken(client);
      const response = await fetch(EVENTS_BASE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `[CalendarPush] create failed userId=${userId} taskId=${task.id} status=${response.status} body=${text.slice(0, 300)}`,
        );
        return null;
      }

      const created = (await response.json()) as GoogleEventResource;
      if (!created.id) {
        this.logger.warn(
          `[CalendarPush] create returned no id userId=${userId} taskId=${task.id}`,
        );
        return null;
      }

      this.logger.log(
        `[CalendarPush] created event=${created.id} for taskId=${task.id} calendar=${PRIMARY_CALENDAR_ID}`,
      );
      return created.id;
    } catch (error) {
      this.logger.warn(
        `[CalendarPush] create error userId=${userId} taskId=${task.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }
  }

  /**
   * Update an existing Google Calendar event linked to the task.
   * Returns true when the remote update succeeded.
   */
  async updateEventForTask(
    userId: string,
    task: Task,
    timeZone: string,
  ): Promise<boolean> {
    if (!task.googleEventId || !task.dueDate) {
      return false;
    }

    const client = await this.getWritableClient(userId);
    if (!client) {
      return false;
    }

    const body = this.buildEventBody(task, timeZone);
    try {
      const accessToken = await this.getAccessToken(client);
      const response = await fetch(
        `${EVENTS_BASE}/${encodeURIComponent(task.googleEventId)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      if (response.status === 404) {
        this.logger.warn(
          `[CalendarPush] update event not found userId=${userId} taskId=${task.id} eventId=${task.googleEventId}`,
        );
        return false;
      }

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `[CalendarPush] update failed userId=${userId} taskId=${task.id} status=${response.status} body=${text.slice(0, 300)}`,
        );
        return false;
      }

      this.logger.log(
        `[CalendarPush] updated event=${task.googleEventId} for taskId=${task.id}`,
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `[CalendarPush] update error userId=${userId} taskId=${task.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return false;
    }
  }

  /**
   * Delete the Google Calendar event linked to the task.
   * Returns true when deleted or already absent (404).
   */
  async deleteEventForTask(
    userId: string,
    task: Task,
  ): Promise<boolean> {
    if (!task.googleEventId) {
      return true;
    }

    const client = await this.getWritableClient(userId);
    if (!client) {
      return false;
    }

    try {
      const accessToken = await this.getAccessToken(client);
      const response = await fetch(
        `${EVENTS_BASE}/${encodeURIComponent(task.googleEventId)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      // 404 / 410 — already gone; treat as success so local link can clear
      if (response.status === 404 || response.status === 410) {
        this.logger.log(
          `[CalendarPush] delete event already gone userId=${userId} eventId=${task.googleEventId}`,
        );
        return true;
      }

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `[CalendarPush] delete failed userId=${userId} taskId=${task.id} status=${response.status} body=${text.slice(0, 300)}`,
        );
        return false;
      }

      this.logger.log(
        `[CalendarPush] deleted event=${task.googleEventId} for taskId=${task.id}`,
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `[CalendarPush] delete error userId=${userId} taskId=${task.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return false;
    }
  }

  private async getWritableClient(userId: string): Promise<OAuth2Client | null> {
    const status = await this.connectionService.getConnectionStatus(userId);
    if (!status.connected || !status.canWrite) {
      return null;
    }
    return this.connectionService.getReadyClient(userId);
  }

  private async getAccessToken(client: OAuth2Client): Promise<string> {
    const tokenResponse = await client.getAccessToken();
    const token =
      typeof tokenResponse === 'string'
        ? tokenResponse
        : tokenResponse?.token ?? client.credentials.access_token;
    if (!token) {
      throw new Error('Missing Google access token');
    }
    return token;
  }

  private buildEventBody(task: Task, timeZone: string): GoogleEventResource {
    const start = new Date(task.dueDate!);
    const end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);
    const tz = timeZone || 'UTC';

    return {
      summary: task.title,
      description: task.description ?? undefined,
      start: {
        dateTime: start.toISOString(),
        timeZone: tz,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: tz,
      },
    };
  }
}

/** Re-export for callers that need the write-scope helper. */
export { hasGoogleCalendarWriteScope };
