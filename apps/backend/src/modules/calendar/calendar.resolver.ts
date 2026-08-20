import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InternalServerErrorException, Logger, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CalendarConnectionService } from './calendar-connection.service';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarEventService } from './calendar-event.service';
import { CalendarEvent } from './entities/calendar-event.entity';
import {
  CalendarConnectionStatus,
  CalendarEventsInput,
  ConnectCalendarInput,
  GetUpcomingCalendarInput,
  SyncCalendarResult,
} from './dto/calendar.dto';

@Resolver()
@UseGuards(GqlAuthGuard)
export class CalendarResolver {
  private readonly logger = new Logger(CalendarResolver.name);

  constructor(
    private readonly connectionService: CalendarConnectionService,
    private readonly syncService: CalendarSyncService,
    private readonly eventService: CalendarEventService,
  ) {}

  @Query(() => CalendarConnectionStatus, { name: 'calendarConnection' })
  getCalendarConnection(
    @CurrentUser() user: User,
  ): Promise<CalendarConnectionStatus> {
    return this.connectionService.getConnectionStatus(user.id);
  }

  @Query(() => [CalendarEvent], { name: 'calendarEvents' })
  getCalendarEvents(
    @CurrentUser() user: User,
    @Args('input') input: CalendarEventsInput,
  ): Promise<CalendarEvent[]> {
    return this.eventService.getEvents(user.id, input.from, input.to);
  }

  @Query(() => [CalendarEvent], { name: 'todayCalendarEvents' })
  getTodayCalendarEvents(@CurrentUser() user: User): Promise<CalendarEvent[]> {
    return this.eventService.getTodayEvents(user.id, user.ianaTimezone ?? 'UTC');
  }

  @Query(() => [CalendarEvent], { name: 'upcomingCalendarEvents' })
  getUpcomingCalendarEvents(
    @CurrentUser() user: User,
    @Args('input', { nullable: true }) input?: GetUpcomingCalendarInput,
  ): Promise<CalendarEvent[]> {
    return this.eventService.getUpcomingEvents(user.id, input?.hours ?? 24);
  }

  @Mutation(() => Boolean, { name: 'connectCalendar' })
  async connectCalendar(
    @CurrentUser() user: User,
    @Args('input') input: ConnectCalendarInput,
  ): Promise<boolean> {
    await this.connectionService.connect(user.id, input.code);
    // Trigger initial sync in background
    void this.syncService.syncForUser(user.id);
    return true;
  }

  @Mutation(() => Boolean, { name: 'disconnectCalendar' })
  async disconnectCalendar(@CurrentUser() user: User): Promise<boolean> {
    await this.connectionService.disconnect(user.id);
    return true;
  }

  @Mutation(() => SyncCalendarResult, { name: 'syncCalendar' })
  syncCalendar(@CurrentUser() user: User): Promise<SyncCalendarResult> {
    return this.syncService.syncForUser(user.id);
  }

  @Query(() => String, { name: 'calendarAuthUrl' })
  getCalendarAuthUrl(@CurrentUser() user: User): string {
    try {
      const state = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
      const url = this.connectionService.getAuthUrl(state);
      this.logger.log(`OAuth URL generated for user ${user.id}`);
      return url;
    } catch (err) {
      this.logger.error('Failed to generate Calendar OAuth URL', err instanceof Error ? err.message : String(err));
      throw new InternalServerErrorException('Could not generate authorization URL. Check Google OAuth configuration.');
    }
  }
}
