import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class ReminderSchedulerService {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processDueReminders(): Promise<void> {
    await this.notificationsService.processDueReminders();
  }
}
