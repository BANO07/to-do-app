import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarConnection } from './entities/calendar-connection.entity';
import { CalendarEvent } from './entities/calendar-event.entity';
import { CalendarConnectionRepository } from './calendar-connection.repository';
import { CalendarEventRepository } from './calendar-event.repository';
import { CalendarConnectionService } from './calendar-connection.service';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarEventService } from './calendar-event.service';
import { CalendarResolver } from './calendar.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([CalendarConnection, CalendarEvent])],
  providers: [
    CalendarConnectionRepository,
    CalendarEventRepository,
    CalendarConnectionService,
    CalendarSyncService,
    CalendarEventService,
    CalendarResolver,
  ],
  exports: [CalendarEventService, CalendarConnectionService, CalendarSyncService],
})
export class CalendarModule {}
