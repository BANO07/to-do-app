import { Injectable } from '@nestjs/common';
import { CalendarEventRepository } from './calendar-event.repository';
import { CalendarEvent } from './entities/calendar-event.entity';
import { normalizeTimeZone } from '../../common/utils/date-time.util';

@Injectable()
export class CalendarEventService {
  constructor(private readonly eventRepo: CalendarEventRepository) {}

  getEvents(userId: string, from: string, to: string): Promise<CalendarEvent[]> {
    return this.eventRepo.findByDateRange(
      userId,
      new Date(from),
      new Date(to),
    );
  }

  getUpcomingEvents(userId: string, hours = 24): Promise<CalendarEvent[]> {
    const now = new Date();
    const to = new Date(now.getTime() + hours * 60 * 60 * 1000);
    return this.eventRepo.findUpcoming(userId, now, to);
  }

  getTodayEvents(userId: string, timeZone?: string): Promise<CalendarEvent[]> {
    const tz = normalizeTimeZone(timeZone);
    const now = new Date();
    // Get start and end of today in the user's timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = formatter.format(now);
    const startOfDay = new Date(`${todayStr}T00:00:00`);
    const endOfDay = new Date(`${todayStr}T23:59:59`);

    // Convert to UTC for comparison (create dates in the local TZ context)
    const startUtc = new Date(
      new Date(`${todayStr}T00:00:00`).toLocaleString('en-US', { timeZone: tz }),
    );
    const endUtc = new Date(
      new Date(`${todayStr}T23:59:59`).toLocaleString('en-US', { timeZone: tz }),
    );

    // Fallback: use midnight UTC offsets
    void startOfDay;
    void endOfDay;

    return this.eventRepo.findByDateRange(userId, startUtc, endUtc);
  }

  /** For weekly review: count events in the week */
  countEventsInWeek(userId: string, weekStart: Date, weekEnd: Date): Promise<number> {
    return this.eventRepo.countInRange(userId, weekStart, weekEnd);
  }
}
